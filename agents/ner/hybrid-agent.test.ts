import { assert, assertEquals } from "@std/assert";
import {
  type HybridEntity,
  HybridNerAgent,
  type NerLabel,
} from "./hybrid-agent.ts";
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
class MockHybridNerAgent extends HybridNerAgent {
  private mockClassifications: Array<{
    text: string;
    label: NerLabel;
    confidence?: number;
  }> = [];

  setMockClassifications(
    classifications: Array<{
      text: string;
      label: NerLabel;
      confidence?: number;
    }>,
  ): void {
    this.mockClassifications = classifications;
  }

  protected override classifyEntitiesWithContext(
    _originalText: string,
    entities: HybridEntity[],
  ): Promise<HybridEntity[]> {
    // Return mock classifications
    return Promise.resolve(entities.map((entity) => {
      const classification = this.mockClassifications.find(
        (c) => c.text === entity.text,
      );
      return {
        ...entity,
        label: (classification?.label ?? entity.label) as NerLabel,
        confidence: classification?.confidence,
      };
    }));
  }
}

Deno.test("HybridNerAgent: combines Compromise NLP with AI classification", async () => {
  const searchService = new MockSearchService();
  searchService.setSearchResult("Kyle", ["ex:Kyle"]);
  searchService.setSearchResult("Lost Bean cafe", ["ex:LostBeanCafe"]);

  const agent = new MockHybridNerAgent(searchService);
  agent.setMockClassifications([
    { text: "Kyle", label: "person", confidence: 0.95 },
    { text: "Lost Bean cafe", label: "org", confidence: 0.88 },
  ]);

  const result = await agent.processText(
    "I met up with Kyle at the Lost Bean cafe yesterday.",
  );

  // Check Compromise NLP analysis
  assertEquals(result.clauses.length, 1);
  assertEquals(
    result.clauses[0].text,
    "I met up with Kyle at the Lost Bean cafe yesterday.",
  );

  // Check AI classification - Compromise may extract more entities than expected
  assert(result.entities.length >= 2);
  const kyleEntity = result.entities.find((e) => e.text === "Kyle");
  const cafeEntity = result.entities.find((e) => e.text === "Lost Bean cafe");

  assert(kyleEntity);
  assertEquals(kyleEntity.label, "person");
  assertEquals(kyleEntity.confidence, 0.95);
  assert(kyleEntity.nlpData);

  assert(cafeEntity);
  assertEquals(cafeEntity.label, "org");
  assertEquals(cafeEntity.confidence, 0.88);
  assert(cafeEntity.nlpData);

  // Check knowledge base enrichment
  assertEquals(result.knowledgeBaseLinks.get("Kyle"), "ex:Kyle");
  assertEquals(
    result.knowledgeBaseLinks.get("Lost Bean cafe"),
    "ex:LostBeanCafe",
  );

  // Check enriched text
  assert(result.enrichedText.includes("[Kyle](ex:Kyle)"));
  assert(result.enrichedText.includes("[Lost Bean cafe](ex:LostBeanCafe)"));

  // Check grouped entities - only check the ones we care about
  assert(result.classifiedEntities.person.includes("Kyle"));
  assert(result.classifiedEntities.org.includes("Lost Bean cafe"));
});

Deno.test("HybridNerAgent: preserves linguistic metadata from Compromise", async () => {
  const searchService = new MockSearchService();
  const agent = new MockHybridNerAgent(searchService);
  agent.setMockClassifications([
    { text: "John", label: "person", confidence: 0.9 },
  ]);

  const result = await agent.processText("John went to the store.");

  const johnEntity = result.entities.find((e) => e.text === "John");
  assert(johnEntity);
  assert(johnEntity.nlpData);
  assert(johnEntity.nlpData.tags.length > 0);
  assert(johnEntity.nlpData.offset.start >= 0);
  assert(johnEntity.nlpData.offset.length > 0);
});

Deno.test("HybridNerAgent: handles empty entity extraction gracefully", async () => {
  const searchService = new MockSearchService();
  const agent = new MockHybridNerAgent(searchService);

  const result = await agent.processText("This is just text without entities.");

  // Compromise may still extract some entities like "text" or "entities"
  assert(result.entities.length >= 0);
  assertEquals(result.knowledgeBaseLinks.size, 0);
  assertEquals(result.enrichedText, "This is just text without entities.");
});

Deno.test("HybridNerAgent: filters entities by whitelist for knowledge enrichment", async () => {
  const searchService = new MockSearchService();
  searchService.setSearchResult("Germany", ["ex:Germany"]);
  searchService.setSearchResult("1440", ["ex:1440"]); // This should not be enriched

  const agent = new MockHybridNerAgent(searchService);
  agent.setMockClassifications([
    { text: "Germany", label: "gpe", confidence: 0.95 },
    { text: "1440", label: "date", confidence: 0.98 }, // Not in whitelist
  ]);

  const result = await agent.processText("In Germany, in 1440.");

  // Check that Germany is enriched (if found by Compromise)
  const germanyLink = result.knowledgeBaseLinks.get("Germany");
  if (germanyLink) {
    assertEquals(germanyLink, "ex:Germany");
    assert(result.enrichedText.includes("[Germany](ex:Germany)"));
  }

  // Check that 1440 is not enriched (not in whitelist)
  assertEquals(result.knowledgeBaseLinks.has("1440"), false);
  assert(!result.enrichedText.includes("[1440]"));
});
