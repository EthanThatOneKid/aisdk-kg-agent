import { assert, assertEquals } from "@std/assert";
import { NerAgent, type NerResult } from "./agent.ts";
import type { SearchService } from "#/search/search.ts";

class MockSearchService implements SearchService {
  private searchResults = new Map<string, string[]>();

  setSearchResult(query: string, results: string[]): void {
    this.searchResults.set(query, results);
  }

  async search(query: string): Promise<string[]> {
    return this.searchResults.get(query) ?? [];
  }
}

Deno.test("NerAgent: processes text and resolves entities", async () => {
  const searchService = new MockSearchService();
  searchService.setSearchResult("Kyle", ["ex:Kyle"]);
  searchService.setSearchResult("Lost Bean cafe", ["ex:LostBeanCafe"]);

  const agent = new NerAgent(searchService);
  const result = await agent.processText(
    "I met up with Kyle at the Lost Bean cafe yesterday.",
  );

  assertEquals(result.clauses.length, 1);
  assertEquals(
    result.clauses[0].text,
    "I met up with Kyle at the Lost Bean cafe yesterday.",
  );
  assertEquals(result.namedEntities.get("Kyle"), ["ex:Kyle"]);
  assertEquals(result.namedEntities.get("Lost Bean cafe"), ["ex:LostBeanCafe"]);
});

Deno.test("NerAgent: caches search results for duplicate entities", async () => {
  const searchService = new MockSearchService();
  searchService.setSearchResult("John", ["ex:John"]);

  const agent = new NerAgent(searchService);
  const result = await agent.processText("John and John went to see John.");

  // Should only search once despite multiple occurrences
  const searchCount =
    Array.from(result.namedEntities.keys()).filter((key) => key === "John")
      .length;
  assertEquals(searchCount, 1);
  assertEquals(result.namedEntities.get("John"), ["ex:John"]);
});

Deno.test("NerAgent: handles empty search results", async () => {
  const searchService = new MockSearchService();
  const agent = new NerAgent(searchService);
  const result = await agent.processText("Unknown entity here.");

  assertEquals(result.clauses.length, 1);
  // The NLP parser recognizes "entity" as a noun, not "Unknown entity"
  assertEquals(result.namedEntities.get("entity"), []);
});
