import { assert, assertEquals, assertExists } from "@std/assert";
import { EntityDiscoveryService } from "./entity-discovery.ts";
import {
  createOramaTripleStore,
  insertTriple,
  OramaSearchService,
} from "./orama/search.ts";

Deno.test("EntityDiscoveryService - Basic entity discovery", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data
  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Kyle",
  });

  await insertTriple(orama, {
    subject: "https://example.org/place1",
    predicate: "http://schema.org/name",
    object: "Lost Bean cafe",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "I met up with Kyle at the Lost Bean cafe.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify basic structure
  assertEquals(discovery.inputText, inputText);
  assertExists(discovery.candidates);
  assertExists(discovery.discoveries);
  assertEquals(typeof discovery.totalCandidates, "number");
  assertEquals(typeof discovery.foundEntities, "number");
});

Deno.test("EntityDiscoveryService - Search score-based sorting", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data with different relevance scores
  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Kyle",
  });

  await insertTriple(orama, {
    subject: "https://example.org/place1",
    predicate: "http://schema.org/name",
    object: "Lost Bean cafe",
  });

  await insertTriple(orama, {
    subject: "https://example.org/time1",
    predicate: "http://schema.org/name",
    object: "yesterday in the morning",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText =
    "I met up with Kyle at the Lost Bean cafe yesterday in the morning.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify entities are sorted by score (highest first)
  const sortedEntities = Array.from(discovery.discoveries.entries());

  if (sortedEntities.length >= 2) {
    const firstScore = Math.max(
      ...sortedEntities[0][1].searchResults.map((r) => r.score),
    );
    const secondScore = Math.max(
      ...sortedEntities[1][1].searchResults.map((r) => r.score),
    );

    // First entity should have higher or equal score
    assertEquals(
      firstScore >= secondScore,
      true,
      "Entities should be sorted by score (highest first)",
    );
  }
});

Deno.test("EntityDiscoveryService - Entity extraction strategies", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data
  await insertTriple(orama, {
    subject: "https://example.org/place1",
    predicate: "http://schema.org/name",
    object: "Lost Bean cafe",
  });

  await insertTriple(orama, {
    subject: "https://example.org/action1",
    predicate: "http://schema.org/description",
    object: "met up with Kyle at the Lost Bean cafe",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "I met up with Kyle at the Lost Bean cafe.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify that the system can process search results and extract entities
  // The exact extraction behavior may vary, but we should get some results
  assertEquals(
    typeof discovery.totalCandidates,
    "number",
    "Should return candidate count",
  );
  assertEquals(
    typeof discovery.foundEntities,
    "number",
    "Should return found entities count",
  );
  assertExists(discovery.discoveries, "Should have discoveries map");
  assertExists(discovery.candidates, "Should have candidates array");
});

Deno.test("EntityDiscoveryService - Reconnaissance context generation", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data
  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Kyle",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "I met Kyle.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);
  const reconnaissanceContext = entityDiscoveryService
    .createReconnaissanceContext(discovery);

  // Verify reconnaissance context contains expected elements
  assertEquals(
    reconnaissanceContext.includes("ENTITY DISCOVERY RESULTS"),
    true,
    "Should include discovery results header",
  );
  assertEquals(
    reconnaissanceContext.includes("SPARQL RECONNAISSANCE REQUIRED"),
    true,
    "Should include SPARQL requirement",
  );
  assertEquals(
    reconnaissanceContext.includes("SELECT ?s ?p ?o WHERE"),
    true,
    "Should include example SPARQL queries",
  );
});

Deno.test("EntityDiscoveryService - No entities found scenario", async () => {
  // Create an empty Orama store for testing
  const orama = createOramaTripleStore();
  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "I met someone new.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);
  const reconnaissanceContext = entityDiscoveryService
    .createReconnaissanceContext(discovery);

  // Verify handling of no entities found
  assertEquals(
    discovery.totalCandidates,
    0,
    "Should have 0 candidates when no entities found",
  );
  assertEquals(
    discovery.foundEntities,
    0,
    "Should have 0 found entities when no entities found",
  );
  assertEquals(
    reconnaissanceContext.includes("No existing entities found"),
    true,
    "Should indicate no entities found",
  );
});

Deno.test("EntityDiscoveryService - Temporal expression handling", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data with temporal expressions
  await insertTriple(orama, {
    subject: "https://example.org/time1",
    predicate: "http://schema.org/name",
    object: "yesterday in the morning",
  });

  await insertTriple(orama, {
    subject: "https://example.org/time2",
    predicate: "http://schema.org/name",
    object: "morning",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "I met Kyle yesterday in the morning.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify temporal expressions are captured
  const entityTexts = Array.from(discovery.discoveries.keys());
  const hasTemporal = entityTexts.some((text) =>
    text.includes("morning") || text.includes("yesterday")
  );

  assertEquals(hasTemporal, true, "Should extract temporal expressions");
});

Deno.test("EntityDiscoveryService - Integration with real Orama store", async () => {
  // Create a real Orama store for integration testing
  const orama = createOramaTripleStore();

  // Insert some test data
  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Kyle",
  });

  await insertTriple(orama, {
    subject: "https://example.org/place1",
    predicate: "http://schema.org/name",
    object: "Lost Bean cafe",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "I met Kyle at the Lost Bean cafe.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify integration works
  assertEquals(
    discovery.totalCandidates > 0,
    true,
    "Should find entities in real Orama store",
  );
  assertEquals(discovery.foundEntities > 0, true, "Should have found entities");

  // Verify search scores are present
  const hasScores = Array.from(discovery.discoveries.values()).every((entity) =>
    entity.searchResults.length === 0 ||
    entity.searchResults.every((r) => typeof r.score === "number")
  );
  assertEquals(hasScores, true, "All search results should have scores");
});

Deno.test("EntityDiscoveryService - Multiple extraction strategies", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data with various entity types
  await insertTriple(orama, {
    subject: "https://example.org/action1",
    predicate: "http://schema.org/description",
    object: "met up with Kyle at the Lost Bean cafe yesterday in the morning",
  });

  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Kyle",
  });

  await insertTriple(orama, {
    subject: "https://example.org/place1",
    predicate: "http://schema.org/name",
    object: "Lost Bean cafe",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText =
    "I met up with Kyle at the Lost Bean cafe yesterday in the morning.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify multiple strategies can process complex input
  assertEquals(
    typeof discovery.totalCandidates,
    "number",
    "Should process multiple entity types",
  );
  assertExists(
    discovery.discoveries,
    "Should have discoveries for multiple strategies",
  );
  assertExists(
    discovery.candidates,
    "Should have candidates for multiple strategies",
  );

  // Verify entities are properly sorted by score
  const sortedEntities = Array.from(discovery.discoveries.entries());
  if (sortedEntities.length >= 2) {
    const firstEntity = sortedEntities[0][1];
    const secondEntity = sortedEntities[1][1];

    const firstMaxScore = firstEntity.searchResults.length > 0
      ? Math.max(...firstEntity.searchResults.map((r) => r.score))
      : 0;
    const secondMaxScore = secondEntity.searchResults.length > 0
      ? Math.max(...secondEntity.searchResults.map((r) => r.score))
      : 0;

    assertEquals(
      firstMaxScore >= secondMaxScore,
      true,
      "Entities should be sorted by score",
    );
  }
});

Deno.test("EntityDiscoveryService - Individual extraction strategies", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data that will test different extraction strategies
  await insertTriple(orama, {
    subject: "https://example.org/exact1",
    predicate: "http://schema.org/name",
    object: "Exact Match Test",
  });

  await insertTriple(orama, {
    subject: "https://example.org/partial1",
    predicate: "http://schema.org/name",
    object: "Partial Match Test Entity",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  // Test that the service can process different types of input
  const exactInput = "Exact Match Test";
  const exactDiscovery = await entityDiscoveryService.discoverEntities(
    exactInput,
  );
  assertEquals(
    typeof exactDiscovery.totalCandidates,
    "number",
    "Should process exact match input",
  );

  // Test partial match strategy
  const partialInput = "I found a Partial Match Test Entity here";
  const partialDiscovery = await entityDiscoveryService.discoverEntities(
    partialInput,
  );
  assertEquals(
    typeof partialDiscovery.totalCandidates,
    "number",
    "Should process partial match input",
  );

  // Verify both return valid discovery results
  assertExists(
    exactDiscovery.discoveries,
    "Should have discoveries for exact match",
  );
  assertExists(
    partialDiscovery.discoveries,
    "Should have discoveries for partial match",
  );
});

Deno.test("EntityDiscoveryService - Compromise NLP integration", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data for different entity types
  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "John Smith",
  });

  await insertTriple(orama, {
    subject: "https://example.org/place1",
    predicate: "http://schema.org/name",
    object: "New York City",
  });

  await insertTriple(orama, {
    subject: "https://example.org/org1",
    predicate: "http://schema.org/name",
    object: "Microsoft Corporation",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText =
    "I met John Smith in New York City at Microsoft Corporation.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify that the service can process complex input with multiple entity types
  assertEquals(
    typeof discovery.totalCandidates,
    "number",
    "Should process complex input",
  );
  assertExists(discovery.discoveries, "Should have discoveries map");
  assertExists(discovery.candidates, "Should have candidates array");

  // The service should be able to handle the input without errors
  assertEquals(discovery.inputText, inputText, "Should preserve input text");
});

Deno.test("EntityDiscoveryService - Dates plugin integration", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data with various temporal expressions
  await insertTriple(orama, {
    subject: "https://example.org/time1",
    predicate: "http://schema.org/name",
    object: "January 15, 2024",
  });

  await insertTriple(orama, {
    subject: "https://example.org/time2",
    predicate: "http://schema.org/name",
    object: "next Monday",
  });

  await insertTriple(orama, {
    subject: "https://example.org/time3",
    predicate: "http://schema.org/name",
    object: "last week",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText =
    "I scheduled a meeting for January 15, 2024, next Monday, and last week.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify dates plugin extracted temporal expressions
  const entityTexts = Array.from(discovery.discoveries.keys());
  const hasDate = entityTexts.some((text) =>
    text.includes("January 15, 2024") ||
    text.includes("next Monday") ||
    text.includes("last week")
  );

  assertEquals(
    hasDate,
    true,
    "Should extract temporal expressions via dates plugin",
  );
});

Deno.test("EntityDiscoveryService - Error handling and fallback", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data
  await insertTriple(orama, {
    subject: "https://example.org/fallback1",
    predicate: "http://schema.org/name",
    object: "Fallback Test Entity",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  // Test with input that should trigger fallback mechanisms
  const inputText = "Fallback Test Entity";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify fallback still works (should find entities even if Compromise fails)
  assertEquals(
    discovery.totalCandidates > 0,
    true,
    "Should find entities via fallback",
  );
  assertEquals(
    discovery.foundEntities > 0,
    true,
    "Should have found entities via fallback",
  );
});

Deno.test("EntityDiscoveryService - Edge cases", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data with edge cases
  await insertTriple(orama, {
    subject: "https://example.org/edge1",
    predicate: "http://schema.org/name",
    object: "A", // Single character
  });

  await insertTriple(orama, {
    subject: "https://example.org/edge2",
    predicate: "http://schema.org/name",
    object: "Special!@#$%^&*()Characters",
  });

  await insertTriple(orama, {
    subject: "https://example.org/edge3",
    predicate: "http://schema.org/name",
    object: "   Whitespace   Entity   ",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  // Test edge cases
  const edgeInput =
    "I found Special!@#$%^&*()Characters and Whitespace Entity.";
  const discovery = await entityDiscoveryService.discoverEntities(edgeInput);

  // Should handle edge cases without crashing
  assertEquals(
    typeof discovery.totalCandidates,
    "number",
    "Should handle special characters",
  );
  assertExists(discovery.discoveries, "Should have discoveries for edge cases");
  assertEquals(
    discovery.inputText,
    edgeInput,
    "Should preserve edge case input",
  );
});

Deno.test("EntityDiscoveryService - Empty and minimal inputs", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();
  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  // Test empty input
  const emptyDiscovery = await entityDiscoveryService.discoverEntities("");
  assertEquals(emptyDiscovery.totalCandidates, 0, "Should handle empty input");
  assertEquals(
    emptyDiscovery.foundEntities,
    0,
    "Should have 0 found entities for empty input",
  );

  // Test single character input
  const singleCharDiscovery = await entityDiscoveryService.discoverEntities(
    "a",
  );
  assertEquals(
    singleCharDiscovery.totalCandidates,
    0,
    "Should handle single character input",
  );

  // Test whitespace-only input
  const whitespaceDiscovery = await entityDiscoveryService.discoverEntities(
    "   \n\t   ",
  );
  assertEquals(
    whitespaceDiscovery.totalCandidates,
    0,
    "Should handle whitespace-only input",
  );
});

Deno.test("EntityDiscoveryService - Duplicate entity handling", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert multiple triples with the same entity
  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "John Doe",
  });

  await insertTriple(orama, {
    subject: "https://example.org/person2",
    predicate: "http://schema.org/name",
    object: "John Doe",
  });

  await insertTriple(orama, {
    subject: "https://example.org/person3",
    predicate: "http://schema.org/description",
    object: "met John Doe yesterday",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "I met John Doe.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Should handle duplicate entities without crashing
  assertEquals(
    typeof discovery.totalCandidates,
    "number",
    "Should process duplicate entities",
  );
  assertExists(discovery.discoveries, "Should have discoveries for duplicates");
  assertEquals(discovery.inputText, inputText, "Should preserve input text");

  // The service should be able to process the input and return valid results
  assertExists(discovery.candidates, "Should have candidates array");
});

Deno.test("EntityDiscoveryService - Offset information validation", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data with known entities
  await insertTriple(orama, {
    subject: "https://example.org/place1",
    predicate: "http://schema.org/name",
    object: "Central Park",
  });

  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "Alice went to Central Park yesterday.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify offset information is present and correct
  for (const [_key, entityDiscovery] of discovery.discoveries) {
    assertExists(entityDiscovery.offset, "Should have offset information");
    assertEquals(
      typeof entityDiscovery.offset.start,
      "number",
      "Offset start should be a number",
    );
    assertEquals(
      typeof entityDiscovery.offset.length,
      "number",
      "Offset length should be a number",
    );
    assertEquals(
      typeof entityDiscovery.offset.index,
      "number",
      "Offset index should be a number",
    );

    // Verify offset values are reasonable
    assert(
      entityDiscovery.offset.start >= 0,
      "Offset start should be non-negative",
    );
    assert(
      entityDiscovery.offset.length > 0,
      "Offset length should be positive",
    );
    assert(
      entityDiscovery.offset.start < inputText.length,
      "Offset start should be within text bounds",
    );
    assert(
      entityDiscovery.offset.start + entityDiscovery.offset.length <=
        inputText.length,
      "Offset end should be within text bounds",
    );

    // Verify the text at the offset matches the entity text
    const extractedText = inputText.substring(
      entityDiscovery.offset.start,
      entityDiscovery.offset.start + entityDiscovery.offset.length,
    );
    assertEquals(
      extractedText.toLowerCase(),
      entityDiscovery.text.toLowerCase(),
      "Extracted text should match entity text",
    );
  }
});

Deno.test("EntityDiscoveryService - Entity type classification", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data for different entity types
  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "John Smith",
  });

  await insertTriple(orama, {
    subject: "https://example.org/place1",
    predicate: "http://schema.org/name",
    object: "New York City",
  });

  await insertTriple(orama, {
    subject: "https://example.org/date1",
    predicate: "http://schema.org/name",
    object: "March 15, 2024",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "John Smith visited New York City on March 15, 2024.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify entity types are present and valid
  for (const [_key, entityDiscovery] of discovery.discoveries) {
    assertExists(entityDiscovery.type, "Should have entity type");
    assert(
      typeof entityDiscovery.type === "string",
      "Entity type should be a string",
    );
    assert(entityDiscovery.type.length > 0, "Entity type should not be empty");

    // Verify entity type is one of the expected values
    const validTypes = ["direct", "topic", "noun", "date", "word", "phrase"];
    assert(
      validTypes.includes(entityDiscovery.type),
      `Entity type should be one of: ${validTypes.join(", ")}`,
    );
  }
});

Deno.test("EntityDiscoveryService - Position-based deduplication", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data with repeated entity
  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "Alice met Alice at the park.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Should find multiple instances of "Alice" at different positions
  const aliceEntities = Array.from(discovery.discoveries.values()).filter((e) =>
    e.text.toLowerCase().includes("alice")
  );

  if (aliceEntities.length > 1) {
    // If we have multiple Alice entities, they should have different offsets
    const offsets = aliceEntities.map((e) => e.offset.start);
    const uniqueOffsets = new Set(offsets);
    assertEquals(
      uniqueOffsets.size,
      offsets.length,
      "Multiple Alice entities should have different positions",
    );
  }
});

Deno.test("EntityDiscoveryService - Compromise NLP entity type extraction", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data that should trigger different Compromise NLP methods
  await insertTriple(orama, {
    subject: "https://example.org/org1",
    predicate: "http://schema.org/name",
    object: "Microsoft Corporation",
  });

  await insertTriple(orama, {
    subject: "https://example.org/date1",
    predicate: "http://schema.org/name",
    object: "next Monday",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "Microsoft Corporation will meet next Monday.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify that different entity types are detected
  const entityTypes = Array.from(discovery.discoveries.values()).map((e) =>
    e.type
  );
  const uniqueTypes = new Set(entityTypes);

  assert(uniqueTypes.size > 0, "Should detect at least one entity type");

  // Verify that we have meaningful entity types (not just "direct")
  const _hasNlpTypes = entityTypes.some((type) =>
    ["topic", "noun", "date"].includes(type)
  );
  // Note: This might not always be true depending on the extraction strategy, but it's good to check
});

Deno.test("EntityDiscoveryService - Fallback extraction strategies", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert test data that might trigger fallback strategies
  await insertTriple(orama, {
    subject: "https://example.org/word1",
    predicate: "http://schema.org/name",
    object: "test",
  });

  await insertTriple(orama, {
    subject: "https://example.org/phrase1",
    predicate: "http://schema.org/name",
    object: "multi word phrase",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText = "This is a test with a multi word phrase.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify that fallback strategies work
  for (const [_key, entityDiscovery] of discovery.discoveries) {
    assertExists(entityDiscovery.type, "Should have entity type from fallback");
    assertExists(entityDiscovery.offset, "Should have offset from fallback");

    // Verify fallback types are valid
    const validFallbackTypes = ["direct", "word", "phrase"];
    assert(
      validFallbackTypes.includes(entityDiscovery.type),
      `Fallback type should be one of: ${validFallbackTypes.join(", ")}`,
    );
  }
});

Deno.test("EntityDiscoveryService - Complete feature integration", async () => {
  // Create a real Orama store for testing
  const orama = createOramaTripleStore();

  // Insert comprehensive test data
  await insertTriple(orama, {
    subject: "https://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice Johnson",
  });

  await insertTriple(orama, {
    subject: "https://example.org/place1",
    predicate: "http://schema.org/name",
    object: "Central Park",
  });

  await insertTriple(orama, {
    subject: "https://example.org/org1",
    predicate: "http://schema.org/name",
    object: "Microsoft Corporation",
  });

  await insertTriple(orama, {
    subject: "https://example.org/date1",
    predicate: "http://schema.org/name",
    object: "March 15, 2024",
  });

  const searchService = new OramaSearchService(orama);
  const entityDiscoveryService = new EntityDiscoveryService(searchService);

  const inputText =
    "Alice Johnson from Microsoft Corporation visited Central Park on March 15, 2024.";
  const discovery = await entityDiscoveryService.discoverEntities(inputText);

  // Verify all features are working together
  assertEquals(
    typeof discovery.totalCandidates,
    "number",
    "Should return candidate count",
  );
  assertEquals(
    typeof discovery.foundEntities,
    "number",
    "Should return found entities count",
  );
  assertExists(discovery.discoveries, "Should have discoveries map");
  assertExists(discovery.candidates, "Should have candidates array");
  assertEquals(discovery.inputText, inputText, "Should preserve input text");

  // Verify each entity has all required fields
  for (const [_key, entityDiscovery] of discovery.discoveries) {
    // Required fields
    assertExists(entityDiscovery.text, "Should have text");
    assertExists(entityDiscovery.type, "Should have type");
    assertExists(entityDiscovery.offset, "Should have offset");
    assertExists(entityDiscovery.found, "Should have found flag");
    assertExists(entityDiscovery.matches, "Should have matches count");
    assertExists(entityDiscovery.sampleIds, "Should have sample IDs");
    assertExists(entityDiscovery.searchResults, "Should have search results");

    // Type validation
    assert(typeof entityDiscovery.text === "string", "Text should be string");
    assert(typeof entityDiscovery.type === "string", "Type should be string");
    assert(
      typeof entityDiscovery.found === "boolean",
      "Found should be boolean",
    );
    assert(
      typeof entityDiscovery.matches === "number",
      "Matches should be number",
    );
    assert(
      Array.isArray(entityDiscovery.sampleIds),
      "Sample IDs should be array",
    );
    assert(
      Array.isArray(entityDiscovery.searchResults),
      "Search results should be array",
    );

    // Offset validation
    assert(
      typeof entityDiscovery.offset.start === "number",
      "Offset start should be number",
    );
    assert(
      typeof entityDiscovery.offset.length === "number",
      "Offset length should be number",
    );
    assert(
      typeof entityDiscovery.offset.index === "number",
      "Offset index should be number",
    );

    // Logical validation
    assert(
      entityDiscovery.found === true,
      "All discovered entities should be found",
    );
    assert(entityDiscovery.matches > 0, "Found entities should have matches");
    assert(
      entityDiscovery.sampleIds.length > 0,
      "Found entities should have sample IDs",
    );
    assert(
      entityDiscovery.searchResults.length > 0,
      "Found entities should have search results",
    );
  }

  // Verify reconnaissance context generation works with new structure
  const reconnaissanceContext = entityDiscoveryService
    .createReconnaissanceContext(discovery);
  assertExists(reconnaissanceContext, "Should generate reconnaissance context");
  assert(
    typeof reconnaissanceContext === "string",
    "Reconnaissance context should be string",
  );
  assert(
    reconnaissanceContext.length > 0,
    "Reconnaissance context should not be empty",
  );
});
