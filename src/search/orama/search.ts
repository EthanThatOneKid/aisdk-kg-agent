import { search } from "@orama/orama";
import type {
  SearchRequest,
  SearchResponse,
  SearchService,
} from "src/search/search.ts";
import type { OramaTripleStore } from "src/orama/triple-store.ts";

/**
 * OramaSearchService searches for candidates in the knowledge graph from the input text.
 */
export class OramaSearchService implements SearchService {
  constructor(private readonly orama: OramaTripleStore) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const result = await search(this.orama, {
      term: request.text,
      properties: ["object"],
    });

    // Deduplicate hits by subject, summing up the scores.
    const hits = result.hits
      .reduce((acc, hit) => {
        const score = acc.get(hit.document.subject) ?? 0;
        acc.set(hit.document.subject, score + hit.score);
        return acc;
      }, new Map<string, number>())
      .entries()
      .toArray()
      .map(([subject, score]) => ({ subject, score }))
      .toSorted((a, b) => b.score - a.score); // Higher scores first.

    return { text: request.text, hits };
  }
}
