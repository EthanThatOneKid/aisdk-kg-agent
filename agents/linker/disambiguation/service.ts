import type { SearchResponse } from "agents/linker/search/service.ts";

// Consider: Rename DisambiguationService to Disambiguator.

/**
 * DisambiguationService resolves the most likely subject from the search results.
 */
export interface DisambiguationService {
  /**
   * disambiguate resolves the most likely subject from the search results.
   * Throws an error if no hits are available.
   */
  disambiguate(data: SearchResponse): Promise<string>;
}
