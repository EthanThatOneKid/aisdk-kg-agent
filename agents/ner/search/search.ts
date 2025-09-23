/**
 * SearchService is a service that provides a way to search for entities.
 */
export interface SearchService {
  search(query: string): Promise<SearchResult[]>;
}

/**
 * SearchResult is a result of a search.
 */
export interface SearchResult {
  subject: string;
  score: number;
}
