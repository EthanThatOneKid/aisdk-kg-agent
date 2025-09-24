import type { NerEntity } from "agents/ner/schema.ts";
import type { SearchResult, SearchService } from "./search.ts";

/**
 * SuggestionsContext is the context for generating suggestions.
 */
export interface SuggestionsContext {
  entities: NerEntity[];
}

/**
 * autosuggest auto-suggests references for a given set of suggestions.
 * Uses forced reconnaissance strategy: only provides references for entities with NO existing matches,
 * forcing the LLM to use SPARQL reconnaissance for entities that DO have matches.
 */
export function autosuggest(
  suggestions: Map<string, SearchResult[]>,
): Array<[string, string]> {
  return Array.from(suggestions.entries())
    .reduce<Array<[string, string]>>((acc, [text, results]) => {
      // Only provide references for entities with NO existing matches
      // This forces the LLM to use SPARQL reconnaissance for entities that DO have matches
      if (results.length === 0) {
        // No existing matches - provide a placeholder that will require generateId
        acc.push([text, ""]);
      }
      // If results.length > 0, we intentionally don't provide the reference
      // This forces the LLM to use SPARQL tool to find the existing ID
      return acc;
    }, []);
}

/**
 * createReconnaissanceContext provides detailed context about entities that need
 * SPARQL reconnaissance, helping the LLM understand what to query for.
 */
export function createReconnaissanceContext(
  suggestions: Map<string, SearchResult[]>,
): string {
  const entitiesNeedingRecon = Array.from(suggestions.entries())
    .filter(([_, results]) => results.length > 0)
    .map(([text, results]) => ({
      entity: text,
      existingMatches: results.length,
      sampleIds: results.slice(0, 2).map((r) => r.subject),
    }));

  if (entitiesNeedingRecon.length === 0) {
    return "No entities found in existing data - all entities will need new IDs generated.";
  }

  const context = [
    "RECONNAISSANCE REQUIRED: The following entities have existing data and MUST be queried via SPARQL:",
    ...entitiesNeedingRecon.map((e) =>
      `- "${e.entity}": Found ${e.existingMatches} existing matches (sample IDs: ${
        e.sampleIds.join(", ")
      })`
    ),
    "",
    "You MUST use the sparql tool to query for these entities before generating any Turtle.",
    "Example SPARQL queries you should run:",
    ...entitiesNeedingRecon.map((e) =>
      `  SELECT ?s ?p ?o WHERE { ?s ?p ?o . FILTER(CONTAINS(LCASE(?o), "${e.entity.toLowerCase()}")) }`
    ),
  ].join("\n");

  return context;
}

/**
 * generateSuggestions generates suggestions for a given set of NER entities.
 */
export async function generateSuggestions(
  service: SearchService,
  context: SuggestionsContext,
) {
  const searchCache = new Map<string, SearchResult[]>();
  for (const entity of context.entities) {
    if (searchCache.has(entity.text)) {
      continue;
    }

    const results = await service.search(entity.text);
    searchCache.set(entity.text, results);
  }

  searchCache.forEach((results, text) => {
    // If no associated results, delete the entry from the cache.
    if (results.length > 0) {
      return;
    }

    searchCache.delete(text);
  });

  return searchCache;
}
