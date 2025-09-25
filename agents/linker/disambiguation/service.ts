import type {
  SearchHit,
  SearchResponse,
} from "agents/linker/search/service.ts";

/**
 * DisambiguationService resolves the most likely subject from the search results.
 */
export interface DisambiguationService {
  /**
   * disambiguate resolves the most likely subject from the search results.
   */
  disambiguate(data: SearchResponse): Promise<SearchHit | null>;
}
