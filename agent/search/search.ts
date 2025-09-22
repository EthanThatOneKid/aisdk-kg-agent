export interface SearchService {
  search(query: string): Promise<string[]>;
}
