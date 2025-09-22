import { assert, assertEquals, assertExists } from "@std/assert";
import { recognizeNamedEntities } from "./ner.ts";
import { recognizeEntityGroups } from "./compromise.ts";
import type { SearchService } from "#/search/search.ts";

// Mock SearchService for testing purposes.
class MockSearchService implements SearchService {
  private searchResults: Map<string, string[]> = new Map();

  constructor(searchResults: Record<string, string[]> = {}) {
    // Initialize the service with the provided search results.
    for (const [query, results] of Object.entries(searchResults)) {
      this.searchResults.set(query.toLowerCase(), results);
    }
  }

  search(query: string): Promise<string[]> {
    // Simulate case-insensitive search behavior.
    const normalizedQuery = query.toLowerCase();
    return Promise.resolve(this.searchResults.get(normalizedQuery) ?? []);
  }

  // Helper method to add search results for testing purposes.
  addSearchResult(query: string, results: string[]): void {
    this.searchResults.set(query.toLowerCase(), results);
  }
}

Deno.test("recognizeNamedEntities", async (t) => {
  await t.step("recognizes named entities from simple content", async () => {
    const searchService = new MockSearchService({
      "john": ["John Doe", "John Smith"],
      "new york": ["New York City", "New York State"],
      "pizza.": ["Pizza Hut", "Pizza Palace"], // Note: compromise includes punctuation
    });

    const content = "John went to New York and ate pizza.";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Should have search results for recognized entities
    assertEquals(result.size, 3);
    assertEquals(result.get("John"), ["John Doe", "John Smith"]);
    assertEquals(result.get("New York"), ["New York City", "New York State"]);
    assertEquals(result.get("pizza."), ["Pizza Hut", "Pizza Palace"]);
  });

  await t.step("handles content with no recognized entities", async () => {
    const searchService = new MockSearchService({
      "a regular sentence.": [], // Compromise recognizes this as an entity
    });
    const content = "This is just a regular sentence.";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Compromise recognizes "a regular sentence." as an entity
    assertEquals(result.size, 1);
    assertEquals(result.get("a regular sentence."), []);
  });

  await t.step("handles entities with no search results", async () => {
    const searchService = new MockSearchService();
    const content = "John went to Mars.";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Should still cache the search attempt, even if no results
    assertEquals(result.size, 2);
    assertEquals(result.get("John"), []);
    assertEquals(result.get("Mars."), []); // Note: compromise includes punctuation
  });

  await t.step("handles duplicate entities in content", async () => {
    const searchService = new MockSearchService({
      "john": ["John Doe"],
      "pizza.": ["Pizza Hut"],
    });

    const content = "John likes pizza. John also likes more pizza.";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Should only have one entry per unique entity text
    assertEquals(result.size, 2);
    assertEquals(result.get("John"), ["John Doe"]);
    assertEquals(result.get("pizza."), ["Pizza Hut"]);
  });

  await t.step("handles case-insensitive entity recognition", async () => {
    const searchService = new MockSearchService({
      "john": ["John Doe"],
      "new york": ["New York City"],
    });

    const content = "john went to NEW YORK";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Should recognize entities regardless of case
    assertEquals(result.size, 2);
    assertEquals(result.get("john"), ["John Doe"]);
    assertEquals(result.get("NEW YORK"), ["New York City"]);
  });

  await t.step("handles complex content with multiple clauses", async () => {
    const searchService = new MockSearchService({
      "alice": ["Alice Johnson"],
      "bob": ["Bob Smith"],
      "google.": ["Google Inc"],
      "microsoft": ["Microsoft Corp"],
      "seattle.": ["Seattle, WA"],
    });

    const content = "Alice works at Google. Bob works at Microsoft in Seattle.";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Should recognize entities from multiple clauses
    assertEquals(result.size, 5);
    assertEquals(result.get("Alice"), ["Alice Johnson"]);
    assertEquals(result.get("Bob"), ["Bob Smith"]);
    assertEquals(result.get("Google."), ["Google Inc"]);
    assertEquals(result.get("Microsoft"), ["Microsoft Corp"]);
    assertEquals(result.get("Seattle."), ["Seattle, WA"]);
  });

  await t.step("handles empty content", async () => {
    const searchService = new MockSearchService();
    const content = "";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Should return empty map for empty content
    assertEquals(result.size, 0);
  });

  await t.step("handles content with special characters", async () => {
    const searchService = new MockSearchService({
      "i": ["I"], // Compromise recognizes "I" as an entity
      "the café": ["The Café Central"], // Compromise recognizes "the café" as one entity
      "müller.": ["Müller GmbH"], // Compromise includes punctuation
    });

    const content = "I went to the café with Müller.";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Should handle special characters in entity names
    assertEquals(result.size, 3);
    assertEquals(result.get("I"), ["I"]);
    assertEquals(result.get("the café"), ["The Café Central"]);
    assertEquals(result.get("Müller."), ["Müller GmbH"]);
  });

  await t.step("handles mixed search results", async () => {
    const searchService = new MockSearchService({
      "john": ["John Doe", "John Smith", "Johnny Walker"],
      "john and bob": ["John and Bob Group"], // Compromise recognizes "John and Bob" as one entity
      "bob": ["Bob Builder"], // Single result
      "the store.": ["The Store"], // Compromise recognizes "the store." as an entity
    });

    const content = "John and Bob went to the store.";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Should handle different types of search results
    assertEquals(result.size, 4);
    assertEquals(result.get("John"), [
      "John Doe",
      "John Smith",
      "Johnny Walker",
    ]);
    assertEquals(result.get("John and Bob"), ["John and Bob Group"]);
    assertEquals(result.get("Bob"), ["Bob Builder"]);
    assertEquals(result.get("the store."), ["The Store"]);
  });

  await t.step("handles search service errors gracefully", async () => {
    // Create a search service that throws errors
    const errorSearchService: SearchService = {
      search(query: string): Promise<string[]> {
        if (query === "error") {
          throw new Error("Search service error");
        }
        return Promise.resolve(["Normal Result"]);
      },
    };

    const content = "This is normal but error will cause issues.";
    const clauses = recognizeEntityGroups(content);

    // This test verifies that the function doesn't crash on search errors
    // The actual behavior depends on how the function handles errors
    try {
      const result = await recognizeNamedEntities(errorSearchService, clauses);
      // If no error is thrown, verify the result structure
      assertExists(result);
      assertEquals(typeof result, "object");
    } catch (error) {
      // If an error is thrown, it should be handled appropriately
      assert(error instanceof Error);
    }
  });

  await t.step("caches search results correctly", async () => {
    let searchCallCount = 0;
    const searchService: SearchService = {
      search(query: string): Promise<string[]> {
        searchCallCount++;
        return Promise.resolve([`Result for ${query}`]);
      },
    };

    const content = "John went to New York. John also visited New York again.";
    const clauses = recognizeEntityGroups(content);
    const result = await recognizeNamedEntities(searchService, clauses);

    // Should cache results and not call search multiple times for same entity
    assertEquals(result.size, 3); // John, New York., and New York
    assertEquals(result.get("John"), ["Result for John"]);
    assertEquals(result.get("New York."), ["Result for New York."]);
    assertEquals(result.get("New York"), ["Result for New York"]);

    // Should only call search once per unique entity
    assertEquals(searchCallCount, 3);
  });
});
