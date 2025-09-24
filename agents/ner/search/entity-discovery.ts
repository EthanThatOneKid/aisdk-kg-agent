// deno-lint-ignore-file no-explicit-any

import type { SearchResult, SearchService } from "./search.ts";
import { default as nlp } from "compromise";
import { default as pluginDates } from "compromise-dates";

// Extend compromise with dates plugin
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
  async discoverEntities(inputText: string): Promise<EntityDiscoveryResult> {
    // Use Orama search directly to find candidates from the input text
    const searchResults = await this.searchService.search(inputText);

    // Extract unique entity candidates from search results
    const candidateMap = new Map<string, EntityDiscovery>();

    for (const result of searchResults) {
      // Extract potential entity text from the search result
      // This could be from subject, predicate, or object fields
      const entityText = this.extractEntityFromSearchResult(result, inputText);
      if (entityText && entityText.length > 1) {
        if (!candidateMap.has(entityText)) {
          candidateMap.set(entityText, {
            text: entityText,
            found: true,
            matches: 0,
            sampleIds: [],
            searchResults: [],
          });
        }

        const discovery = candidateMap.get(entityText)!;
        discovery.matches++;
        discovery.sampleIds.push(result.subject);
        discovery.searchResults.push(result);
      }
    }

    // Sort discoveries by search score (highest score first)
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
      candidates: Array.from(candidateMap.keys()),
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
  ): string | null {
    const inputLower = inputText.toLowerCase();
    const objectLower = result.object.toLowerCase();

    // Try different extraction strategies and return the best match
    const strategies = [
      () => this.extractDirectMatch(objectLower, inputLower),
      () => this.extractWithCompromise(objectLower, inputLower),
    ];

    let bestMatch = "";
    let bestLength = 0;

    for (const strategy of strategies) {
      const match = strategy();
      if (match && match.length > bestLength) {
        bestMatch = match;
        bestLength = match.length;
      }
    }

    return bestMatch || null;
  }

  /**
   * extractDirectMatch finds exact matches between object and input.
   */
  private extractDirectMatch(
    objectText: string,
    inputLower: string,
  ): string | null {
    const objectLower = objectText.toLowerCase();
    return inputLower.includes(objectLower) ? objectText : null;
  }

  /**
   * extractWithCompromise uses Compromise NLP to find better entity matches
   * by leveraging linguistic understanding of the text. Based on nlp.ts patterns.
   */
  private extractWithCompromise(
    objectText: string,
    inputLower: string,
  ): string | null {
    try {
      const doc = nlp(objectText);
      let bestMatch = "";
      let bestLength = 0;

      // Helper function to check and update best match
      const checkMatch = (text: string) => {
        const cleanText = text.trim().toLowerCase();
        if (cleanText.length > 1 && inputLower.includes(cleanText)) {
          if (cleanText.length > bestLength) {
            bestMatch = text.trim();
            bestLength = cleanText.length;
          }
        }
      };

      // Extract topics (proper nouns, organizations, etc.) - same as nlp.ts
      const topics = doc.topics().json({ offset: true, unique: true });
      topics.forEach((topic: any) => {
        checkMatch(topic.text);
      });

      // Extract nouns (including proper nouns) - same as nlp.ts
      const nouns = doc.nouns().json({ offset: true, unique: true });
      nouns.forEach((noun: any) => {
        checkMatch(noun.text);
      });

      // Extract dates and times using Compromise dates plugin - same as nlp.ts
      const dates = (doc as any).dates().json({ offset: true, unique: true });
      dates.forEach((date: any) => {
        checkMatch(date.text);
      });

      return bestMatch || null;
    } catch (_e) {
      // Fallback to simple word matching if Compromise fails
      return this.extractLongestSubstringFallback(objectText, inputLower);
    }
  }

  /**
   * extractLongestSubstringFallback provides a simple fallback when Compromise is unavailable.
   */
  private extractLongestSubstringFallback(
    objectText: string,
    inputLower: string,
  ): string | null {
    const words = objectText.split(/\s+/);
    let bestMatch = "";
    let bestLength = 0;

    // Check single words
    for (const word of words) {
      const cleanWord = word.replace(/[.,!?;:]$/, "").toLowerCase();
      if (cleanWord.length > 1 && inputLower.includes(cleanWord)) {
        if (cleanWord.length > bestLength) {
          bestMatch = word.replace(/[.,!?;:]$/, "");
          bestLength = cleanWord.length;
        }
      }
    }

    // Check multi-word phrases (2-5 words)
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
          bestMatch = phrase;
          bestLength = phraseLower.length;
        }
      }
    }

    return bestMatch || null;
  }

  /**
   * createReconnaissanceContext generates context for the LLM about
   * entities that need SPARQL reconnaissance, without requiring NER.
   */
  createReconnaissanceContext(discovery: EntityDiscoveryResult): string {
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
      "SPARQL RECONNAISSANCE REQUIRED: You MUST use the sparql tool to query for these entities before generating any Turtle.",
      "Example SPARQL queries you should run:",
      ...foundEntities.map((e) =>
        `  SELECT ?s ?p ?o WHERE { ?s ?p ?o . FILTER(CONTAINS(LCASE(?o), "${e.text.toLowerCase()}")) }`
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

export interface EntityDiscovery {
  text: string;
  found: boolean;
  matches: number;
  sampleIds: string[];
  searchResults: any[]; // SearchResult[] from the search service
}

export interface EntityDiscoveryResult {
  inputText: string;
  candidates: string[];
  discoveries: Map<string, EntityDiscovery>;
  totalCandidates: number;
  foundEntities: number;
}
