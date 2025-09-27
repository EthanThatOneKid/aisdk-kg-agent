import type { SearchResponse } from "agents/linker/search/search.ts";

/**
 * Disambiguator resolves the most likely subject from the search results.
 */
export interface Disambiguator {
  /**
   * disambiguate resolves the most likely subject from the search results.
   * Throws an error if no hits are available.
   */
  disambiguate(data: SearchResponse): Promise<string>;
}
