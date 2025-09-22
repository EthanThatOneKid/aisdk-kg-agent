import { assert, assertEquals } from "@std/assert";
import { NER_LABELS, NerAgent } from "./agent.ts";
import type { SearchService } from "#/search/search.ts";

class MockSearchService implements SearchService {
  private searchResults = new Map<string, string[]>();

  setSearchResult(query: string, results: string[]): void {
    this.searchResults.set(query, results);
  }

  search(query: string): Promise<string[]> {
    return Promise.resolve(this.searchResults.get(query) ?? []);
  }
}

// Mock the AI model for testing
class MockNerAgent extends NerAgent {
  private mockClassifiedEntities: Record<string, string[]> = {};

  setMockClassification(entities: Record<string, string[]>): void {
    this.mockClassifiedEntities = entities;
  }

  protected override classifyEntities(
    _text: string,
  ): Promise<Record<string, string[]>> {
    // Return mock data instead of calling AI
    const result: Record<string, string[]> = {};
    for (const label of NER_LABELS) {
      result[label] = this.mockClassifiedEntities[label] ?? [];
    }
    return Promise.resolve(result);
  }
}

Deno.test("NerAgent: processes text with AI classification and knowledge enrichment", async () => {
  const searchService = new MockSearchService();
  searchService.setSearchResult("Kyle", ["ex:Kyle"]);
  searchService.setSearchResult("Lost Bean cafe", ["ex:LostBeanCafe"]);

  const agent = new MockNerAgent(searchService);
  agent.setMockClassification({
    person: ["Kyle"],
    org: ["Lost Bean cafe"],
  });

  const result = await agent.processText(
    "I met up with Kyle at the Lost Bean cafe yesterday.",
  );

  assertEquals(
    result.originalText,
    "I met up with Kyle at the Lost Bean cafe yesterday.",
  );
  assertEquals(result.classifiedEntities.person, ["Kyle"]);
  assertEquals(result.classifiedEntities.org, ["Lost Bean cafe"]);
  assertEquals(result.knowledgeBaseLinks.get("Kyle"), "ex:Kyle");
  assertEquals(
    result.knowledgeBaseLinks.get("Lost Bean cafe"),
    "ex:LostBeanCafe",
  );
  assert(result.enrichedText.includes("[Kyle](ex:Kyle)"));
  assert(result.enrichedText.includes("[Lost Bean cafe](ex:LostBeanCafe)"));
});

Deno.test("NerAgent: handles empty knowledge base results", async () => {
  const searchService = new MockSearchService();
  const agent = new MockNerAgent(searchService);
  agent.setMockClassification({
    person: ["Unknown Person"],
  });

  const result = await agent.processText("I met Unknown Person.");

  assertEquals(result.classifiedEntities.person, ["Unknown Person"]);
  assertEquals(result.knowledgeBaseLinks.size, 0);
  assertEquals(result.enrichedText, "I met Unknown Person.");
});

Deno.test("NerAgent: filters entities by whitelist for knowledge enrichment", async () => {
  const searchService = new MockSearchService();
  searchService.setSearchResult("Germany", ["ex:Germany"]);
  searchService.setSearchResult("1440", ["ex:1440"]); // This should not be enriched

  const agent = new MockNerAgent(searchService);
  agent.setMockClassification({
    gpe: ["Germany"],
    date: ["1440"], // Not in whitelist
  });

  const result = await agent.processText("In Germany, in 1440.");

  assertEquals(result.knowledgeBaseLinks.get("Germany"), "ex:Germany");
  assertEquals(result.knowledgeBaseLinks.has("1440"), false);
  assert(result.enrichedText.includes("[Germany](ex:Germany)"));
  assert(!result.enrichedText.includes("[1440]"));
});
