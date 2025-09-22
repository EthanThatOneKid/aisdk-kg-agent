import type { SearchService } from "#/search/search.ts";
import type { NlpClause } from "./compromise.ts";

/**
 * recognizeNamedEntities recognizes named entities in a given content.
 *
 * @note NER stands for "Named Entity Recognition".
 */
export async function recognizeNamedEntities(
  service: SearchService,
  clauses: NlpClause[],
) {
  const searchCache = new Map<string, string[]>();
  for (const clause of clauses) {
    for (const entity of clause.entities) {
      if (searchCache.has(entity.text)) {
        continue;
      }

      const namedEntities = await service.search(entity.text);
      searchCache.set(entity.text, namedEntities);
    }
  }

  return searchCache;
}
