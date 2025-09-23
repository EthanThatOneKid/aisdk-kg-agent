import type { NerEntity } from "agents/ner/schema.ts";
import type { SearchResult, SearchService } from "./search.ts";

/**
 * SuggestionsContext is the context for generating suggestions.
 */
export interface SuggestionsContext {
  entities: NerEntity[];
  user?: { id: string };
  generateId?: (text: string) => string;
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

    // Resolve the user to their own ID.
    if (context.user !== undefined && entity.text === "I") {
      searchCache.set(
        entity.text,
        [{ subject: context.user.id, score: 0 }],
      );
      continue;
    }

    const results = await service.search(entity.text);
    searchCache.set(entity.text, results);
  }

  const entityIds = new Map<string, string>();
  searchCache.forEach((results, text) => {
    // If we have a generateId function, use it to generate a unique ID for the entity.
    if (context.generateId !== undefined) {
      const id = entityIds.get(text) ?? context.generateId(text);
      entityIds.set(text, id);
      results.push({ subject: id, score: 0 });
      return;
    }

    // If no associated results, delete the entry from the cache.
    if (results.length > 0) {
      return;
    }

    searchCache.delete(text);
  });

  return searchCache;
}
