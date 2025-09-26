import { assertEquals, assertExists } from "@std/assert";
import { EntityLinker } from "./entity-linker.ts";
import { CompromiseService } from "./ner/compromise/ner.ts";
import { GreedyDisambiguationService } from "./disambiguation/greedy/disambiguation.ts";
import { OramaSearchService } from "./search/orama/search.ts";
import {
  createOramaTripleStore,
  insertTriple,
} from "./search/orama/triple-store.ts";

Deno.test("EntityLinker - constructor", () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Verify the linker is created successfully.
  assertExists(linker);
  assertEquals(typeof linker.linkEntities, "function");
  assertEquals(typeof linker.linkEntity, "function");
});

Deno.test("EntityLinker - linkEntities with no entities", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Test with text that should not produce entities
  const result = await linker.linkEntities("123456789");

  assertEquals(result.length, 0);
  assertEquals(Array.isArray(result), true);
});

Deno.test("EntityLinker - linkEntities with single entity, no search results", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Test with a name that won't be found in empty store
  const result = await linker.linkEntities("Alice went to the store");

  // Should have entities from NER but no search results
  assertEquals(result.length > 0, true);

  // All entities should have null hits since store is empty
  result.forEach((linkedEntity) => {
    assertEquals(linkedEntity.hit, null);
  });
});

Deno.test("EntityLinker - linkEntities with single entity, with search results", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Insert test data
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice",
  });

  const result = await linker.linkEntities("Alice went to the store");

  // Should have entities from NER
  assertEquals(result.length > 0, true);

  // Should have at least one linked entity
  const linkedEntities = result.filter((le) => le.hit !== null);
  assertEquals(linkedEntities.length > 0, true);

  // Verify the structure
  linkedEntities.forEach((linkedEntity) => {
    assertExists(linkedEntity.entity);
    assertExists(linkedEntity.entity.text);
    assertExists(linkedEntity.entity.offset);
    assertExists(linkedEntity.hit);
    assertExists(linkedEntity.hit.subject);
    assertExists(linkedEntity.hit.score);
  });
});

Deno.test("EntityLinker - linkEntities with multiple entities", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Insert test data for multiple entities
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice",
  });

  await insertTriple(store, {
    subject: "http://example.org/place1",
    predicate: "http://schema.org/name",
    object: "Central Park",
  });

  const result = await linker.linkEntities(
    "Alice and Bob went to Central Park",
  );

  // Should have multiple entities from NER
  assertEquals(result.length > 0, true);

  // Should have some linked entities
  const linkedEntities = result.filter((le) => le.hit !== null);
  assertEquals(linkedEntities.length > 0, true);

  // Verify we found both Alice and Central Park
  const entityTexts = result.map((le) => le.entity.text);
  const hasAlice = entityTexts.some((text) => text.includes("Alice"));
  const hasCentralPark = entityTexts.some((text) =>
    text.includes("Central Park")
  );
  assertEquals(hasAlice, true);
  assertEquals(hasCentralPark, true);
});

Deno.test("EntityLinker - linkEntity with no search results", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(
    new CompromiseService(),
    search,
    disambiguation,
  );

  // Create a mock entity that won't be found
  const entity = {
    text: "UnknownEntity12345",
    offset: { index: 0, start: 0, length: 17 },
  };

  const result = await linker.linkEntity(entity);

  assertEquals(result, null);
});

Deno.test("EntityLinker - linkEntity with search results", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(
    new CompromiseService(),
    search,
    disambiguation,
  );

  // Insert test data
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice",
  });

  // Create an entity that should match
  const entity = {
    text: "Alice",
    offset: { index: 0, start: 0, length: 5 },
  };

  const result = await linker.linkEntity(entity);

  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score > 0, true);
});

Deno.test("EntityLinker - integration with real services", async () => {
  // Create real services for integration testing
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();
  const ner = new CompromiseService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Insert some test data
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice Smith",
  });

  await insertTriple(store, {
    subject: "http://example.org/place1",
    predicate: "http://schema.org/name",
    object: "Central Park",
  });

  // Test with text that should match our data
  const result = await linker.linkEntities("Alice went to Central Park");

  // Should have multiple entities
  assertEquals(result.length > 0, true);

  // Check that we have some linked entities
  const linkedEntities = result.filter((le) => le.hit !== null);
  assertEquals(linkedEntities.length > 0, true);

  // Verify the structure of linked entities
  linkedEntities.forEach((linkedEntity) => {
    assertExists(linkedEntity.entity);
    assertExists(linkedEntity.entity.text);
    assertExists(linkedEntity.entity.offset);
    assertExists(linkedEntity.hit);
    assertExists(linkedEntity.hit.subject);
    assertExists(linkedEntity.hit.score);
  });
});

Deno.test("EntityLinker - handles empty text", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  const result = await linker.linkEntities("");

  assertEquals(result.length, 0);
});

Deno.test("EntityLinker - handles entities with special characters", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Insert test data with special characters
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "José María",
  });

  await insertTriple(store, {
    subject: "http://example.org/person2",
    predicate: "http://schema.org/name",
    object: "O'Connor-Smith",
  });

  const result = await linker.linkEntities("José María and O'Connor-Smith met");

  // Should have entities from NER
  assertEquals(result.length > 0, true);

  // Should have some linked entities
  const linkedEntities = result.filter((le) => le.hit !== null);
  assertEquals(linkedEntities.length > 0, true);
});

Deno.test("EntityLinker - handles entities with overlapping text", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Insert test data
  await insertTriple(store, {
    subject: "http://example.org/city1",
    predicate: "http://schema.org/name",
    object: "New York",
  });

  await insertTriple(store, {
    subject: "http://example.org/city2",
    predicate: "http://schema.org/name",
    object: "York",
  });

  const result = await linker.linkEntities("New York is a city");

  // Should have entities from NER
  assertEquals(result.length > 0, true);

  // Should have some linked entities
  const linkedEntities = result.filter((le) => le.hit !== null);
  assertEquals(linkedEntities.length > 0, true);
});

Deno.test("EntityLinker - preserves entity offset information", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  const result = await linker.linkEntities("Hello Alice and Bob");

  // Should have entities from NER
  assertEquals(result.length > 0, true);

  // Verify offset information is preserved
  result.forEach((linkedEntity) => {
    assertExists(linkedEntity.entity.offset);
    assertExists(linkedEntity.entity.offset.start);
    assertExists(linkedEntity.entity.offset.length);
    assertEquals(linkedEntity.entity.offset.start >= 0, true);
    assertEquals(linkedEntity.entity.offset.length > 0, true);
  });
});

Deno.test("EntityLinker - handles concurrent entity linking", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(
    new CompromiseService(),
    search,
    disambiguation,
  );

  // Insert test data
  await insertTriple(store, {
    subject: "http://example.org/1",
    predicate: "http://schema.org/name",
    object: "Entity1",
  });

  await insertTriple(store, {
    subject: "http://example.org/2",
    predicate: "http://schema.org/name",
    object: "Entity2",
  });

  await insertTriple(store, {
    subject: "http://example.org/3",
    predicate: "http://schema.org/name",
    object: "Entity3",
  });

  // Test concurrent linking
  const promises = [
    linker.linkEntity({
      text: "Entity1",
      offset: { index: 0, start: 0, length: 7 },
    }),
    linker.linkEntity({
      text: "Entity2",
      offset: { index: 1, start: 8, length: 7 },
    }),
    linker.linkEntity({
      text: "Entity3",
      offset: { index: 2, start: 16, length: 7 },
    }),
  ];

  const results = await Promise.all(promises);

  assertEquals(results.length, 3);
  assertEquals(results[0]?.subject, "http://example.org/1");
  assertEquals(results[1]?.subject, "http://example.org/2");
  assertEquals(results[2]?.subject, "http://example.org/3");
});

Deno.test("EntityLinker - handles multiple search results and disambiguation", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Insert multiple entities with similar names
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice Smith",
  });

  await insertTriple(store, {
    subject: "http://example.org/person2",
    predicate: "http://schema.org/name",
    object: "Alice Johnson",
  });

  await insertTriple(store, {
    subject: "http://example.org/person3",
    predicate: "http://schema.org/description",
    object: "Alice is a software engineer",
  });

  const result = await linker.linkEntities("Alice went to the store");

  // Should have entities from NER
  assertEquals(result.length > 0, true);

  // Should have some linked entities
  const linkedEntities = result.filter((le) => le.hit !== null);
  assertEquals(linkedEntities.length > 0, true);

  // Verify disambiguation worked (should return the first/highest scoring result)
  linkedEntities.forEach((linkedEntity) => {
    assertExists(linkedEntity.hit);
    assertEquals(linkedEntity.hit.score > 0, true);
  });
});

Deno.test("EntityLinker - handles case sensitivity", async () => {
  const store = createOramaTripleStore();
  const ner = new CompromiseService();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(ner, search, disambiguation);

  // Insert test data with specific case
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice Smith",
  });

  // Test with different cases
  const result1 = await linker.linkEntities("Alice went to the store");
  const result2 = await linker.linkEntities("alice went to the store");

  // Both should produce results (Orama is typically case-insensitive)
  assertEquals(result1.length > 0, true);
  assertEquals(result2.length > 0, true);

  // Both should have linked entities
  const linked1 = result1.filter((le) => le.hit !== null);
  const linked2 = result2.filter((le) => le.hit !== null);
  assertEquals(linked1.length > 0, true);
  assertEquals(linked2.length > 0, true);
});
