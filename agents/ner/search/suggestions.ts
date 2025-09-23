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
 */
export function autosuggest(
  suggestions: Map<string, SearchResult[]>,
): Array<[string, string]> {
  return Array.from(suggestions.entries())
    .reduce<Array<[string, string]>>((acc, [text, results]) => {
      const id = results.at(0)?.subject;
      if (id === undefined) {
        return acc;
      }

      acc.push([text, id]);
      return acc;
    }, []);
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
