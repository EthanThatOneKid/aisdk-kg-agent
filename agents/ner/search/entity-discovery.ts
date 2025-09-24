// deno-lint-ignore-file no-explicit-any

import type { SearchResult, SearchService } from "./search.ts";
import type { NerOffset } from "../schema.ts";
import { default as nlp } from "compromise";
import { default as pluginDates } from "compromise-dates";

// Extend compromise with dates plugin.
nlp.extend(pluginDates);

/**
 * EntityDiscoveryService provides LLM-driven entity identification
 * by leveraging the Orama search service to find potential entities
 * in existing data, without relying on NER preprocessing.
 */
export class EntityDiscoveryService {
  constructor(private readonly searchService: SearchService) {}

  /**
   * discoverEntities finds potential entities in the input text by searching
   * for them directly in the existing knowledge graph using Orama search.
   * This provides reconnaissance context for the LLM without requiring NER preprocessing.
   */
  async discoverEntities(
    inputText: string,
  ): Promise<EntityDiscoveryResult<SearchResult>> {
    // Use Orama search directly to find candidates from the input text.
    const searchResults = await this.searchService.search(inputText);

    // Extract unique entity candidates from search results.
    const candidateMap = new Map<string, EntityDiscovery<SearchResult>>();

    for (const result of searchResults) {
      // Extract potential entity text from the search result.
      // This could be from subject, predicate, or object fields.
      const entityData = this.extractEntityFromSearchResult(result, inputText);
      if (entityData && entityData.text.length > 1) {
        const entityKey =
          `${entityData.text}:${entityData.offset.start}:${entityData.offset.length}`;
        if (!candidateMap.has(entityKey)) {
          candidateMap.set(entityKey, {
            text: entityData.text,
            type: entityData.type,
            offset: entityData.offset,
            found: true,
            matches: 0,
            sampleIds: [],
            searchResults: [],
          });
        }

        const discovery = candidateMap.get(entityKey)!;
        discovery.matches++;
        discovery.sampleIds.push(result.subject);
        discovery.searchResults.push(result);
      }
    }

    // Sort discoveries by search score (highest score first).
    const sortedDiscoveries = new Map(
      Array.from(candidateMap.entries()).sort(([, a], [, b]) => {
        const scoreA = a.searchResults.length > 0
          ? Math.max(...a.searchResults.map((r) => r.score))
          : 0;
        const scoreB = b.searchResults.length > 0
          ? Math.max(...b.searchResults.map((r) => r.score))
          : 0;
        return scoreB - scoreA; // Higher scores first
      }),
    );

    return {
      inputText,
      candidates: Array.from(candidateMap.values()).map((d) => d.text),
      discoveries: sortedDiscoveries,
      totalCandidates: candidateMap.size,
      foundEntities: candidateMap.size,
    };
  }

  /**
   * extractEntityFromSearchResult extracts potential entity text from a search result
   * by finding the part of the search result object that appears in the input text.
   * Uses Compromise NLP for more sophisticated entity matching.
   */
  private extractEntityFromSearchResult(
    result: SearchResult,
    inputText: string,
  ): { text: string; type: string; offset: NerOffset } | null {
    const inputLower = inputText.toLowerCase();
    const objectLower = result.object.toLowerCase();

    // Try different extraction strategies and return the best match.
    const strategies = [
      () => this.extractDirectMatch(objectLower, inputLower, inputText),
      () => this.extractWithCompromise(objectLower, inputLower, inputText),
    ];

    let bestMatch: { text: string; type: string; offset: NerOffset } | null =
      null;
    let bestLength = 0;

    for (const strategy of strategies) {
      const match = strategy();
      if (match && match.text.length > bestLength) {
        bestMatch = match;
        bestLength = match.text.length;
      }
    }

    return bestMatch;
  }

  /**
   * extractDirectMatch finds exact matches between object and input.
   */
  private extractDirectMatch(
    objectText: string,
    inputLower: string,
    _inputText: string,
  ): { text: string; type: string; offset: NerOffset } | null {
    const objectLower = objectText.toLowerCase();
    if (inputLower.includes(objectLower)) {
      const start = inputLower.indexOf(objectLower);
      return {
        text: objectText,
        type: "direct",
        offset: {
          index: start,
          start: start,
          length: objectText.length,
        },
      };
    }
    return null;
  }

  /**
   * extractWithCompromise uses Compromise NLP to find better entity matches
   * by leveraging linguistic understanding of the text. Based on nlp.ts patterns.
   */
  private extractWithCompromise(
    objectText: string,
    inputLower: string,
    inputText: string,
  ): { text: string; type: string; offset: NerOffset } | null {
    try {
      const doc = nlp(objectText);
      let bestMatch: { text: string; type: string; offset: NerOffset } | null =
        null;
      let bestLength = 0;

      // Helper function to check and update best match.
      const checkMatch = (text: string, type: string, _offset: any) => {
        const cleanText = text.trim().toLowerCase();
        if (cleanText.length > 1 && inputLower.includes(cleanText)) {
          if (cleanText.length > bestLength) {
            const start = inputLower.indexOf(cleanText);
            bestMatch = {
              text: text.trim(),
              type: type,
              offset: {
                index: start,
                start: start,
                length: text.trim().length,
              },
            };
            bestLength = cleanText.length;
          }
        }
      };

      // Extract topics (proper nouns, organizations, etc.) - same as nlp.ts.
      const topics = doc.topics().json({ offset: true, unique: true });
      topics.forEach((topic: any) => {
        checkMatch(topic.text, "topic", topic.offset);
      });

      // Extract nouns (including proper nouns) - same as nlp.ts.
      const nouns = doc.nouns().json({ offset: true, unique: true });
      nouns.forEach((noun: any) => {
        checkMatch(noun.text, "noun", noun.offset);
      });

      // Extract dates and times using Compromise dates plugin - same as nlp.ts.
      const dates = (doc as any).dates().json({ offset: true, unique: true });
      dates.forEach((date: any) => {
        checkMatch(date.text, "date", date.offset);
      });

      return bestMatch;
    } catch (_e) {
      // Fallback to simple word matching if Compromise fails.
      return this.extractLongestSubstringFallback(
        objectText,
        inputLower,
        inputText,
      );
    }
  }

  /**
   * extractLongestSubstringFallback provides a simple fallback when Compromise is unavailable.
   */
  private extractLongestSubstringFallback(
    objectText: string,
    inputLower: string,
    _inputText: string,
  ): { text: string; type: string; offset: NerOffset } | null {
    const words = objectText.split(/\s+/);
    let bestMatch: { text: string; type: string; offset: NerOffset } | null =
      null;
    let bestLength = 0;

    // Check single words.
    for (const word of words) {
      const cleanWord = word.replace(/[.,!?;:]$/, "").toLowerCase();
      if (cleanWord.length > 1 && inputLower.includes(cleanWord)) {
        if (cleanWord.length > bestLength) {
          const start = inputLower.indexOf(cleanWord);
          bestMatch = {
            text: word.replace(/[.,!?;:]$/, ""),
            type: "word",
            offset: {
              index: start,
              start: start,
              length: word.replace(/[.,!?;:]$/, "").length,
            },
          };
          bestLength = cleanWord.length;
        }
      }
    }

    // Check multi-word phrases (2-5 words).
    for (let i = 0; i < words.length - 1; i++) {
      for (
        let length = 2;
        length <= 5 && i + length <= words.length;
        length++
      ) {
        const phrase = words.slice(i, i + length)
          .map((w) => w.replace(/[.,!?;:]$/, ""))
          .join(" ");
        const phraseLower = phrase.toLowerCase();

        if (
          inputLower.includes(phraseLower) && phraseLower.length > bestLength
        ) {
          const start = inputLower.indexOf(phraseLower);
          bestMatch = {
            text: phrase,
            type: "phrase",
            offset: {
              index: start,
              start: start,
              length: phrase.length,
            },
          };
          bestLength = phraseLower.length;
        }
      }
    }

    return bestMatch;
  }

  /**
   * createReconnaissanceContext generates context for the LLM about
   * entities that need SPARQL reconnaissance, using recognized entity IDs.
   */
  createReconnaissanceContext(
    discovery: EntityDiscoveryResult<SearchResult>,
  ): string {
    const foundEntities = Array.from(discovery.discoveries.values())
      .filter((d) => d.found);

    const notFoundEntities = Array.from(discovery.discoveries.values())
      .filter((d) => !d.found);

    if (foundEntities.length === 0) {
      return "No existing entities found in the knowledge graph. All entities will need new IDs generated.";
    }

    const context = [
      "ENTITY DISCOVERY RESULTS (sorted by search relevance): The following entities were found in the existing knowledge graph:",
      ...foundEntities.map((e) => {
        const maxScore = e.searchResults.length > 0
          ? Math.max(...e.searchResults.map((r) => r.score))
          : 0;
        return `- "${e.text}": Found ${e.matches} existing matches (max score: ${
          maxScore.toFixed(3)
        }) (sample IDs: ${e.sampleIds.join(", ")})`;
      }),
      "",
      "SPARQL RECONNAISSANCE REQUIRED: You MUST use the sparql tool to query for these recognized entity IDs before generating any Turtle.",
      "Example SPARQL queries you should run (using the recognized IDs):",
      ...foundEntities.flatMap((e) =>
        e.sampleIds.slice(0, 2).map((id) =>
          `  SELECT ?s ?p ?o WHERE { <${id}> ?p ?o . }`
        )
      ),
      "",
      notFoundEntities.length > 0
        ? `NEW ENTITIES: The following entities were not found and will need new IDs: ${
          notFoundEntities.map((e) => `"${e.text}"`).join(", ")
        }`
        : "All discovered entities have existing data.",
    ].join("\n");

    return context;
  }
}

export interface EntityDiscovery<T = any> {
  text: string;
  type: string; // Entity type: "topic", "noun", "date", etc.
  offset: NerOffset; // Position information in the original text
  found: boolean;
  matches: number;
  sampleIds: string[];
  searchResults: T[]; // SearchResult[] from the search service
}

export interface EntityDiscoveryResult<T = any> {
  inputText: string;
  candidates: string[];
  discoveries: Map<string, EntityDiscovery<T>>;
  totalCandidates: number;
  foundEntities: number;
}
