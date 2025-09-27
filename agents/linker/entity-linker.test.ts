import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import type { GeneratedTurtleVariable } from "agents/turtle/schema.ts";
import { EntityLinker } from "./entity-linker.ts";
import { GreedyDisambiguationService } from "./disambiguation/greedy/disambiguation.ts";
import { OramaSearchService } from "./search/orama/search.ts";
import {
  createOramaTripleStore,
  insertTriple,
} from "./search/orama/triple-store.ts";

Deno.test("EntityLinker - constructor", () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Verify the linker is created successfully.
  assertExists(linker);
  assertEquals(typeof linker.linkEntities, "function");
  assertEquals(typeof linker.linkEntity, "function");
});

Deno.test("EntityLinker - linkEntities with no entities", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Verify empty entities array returns empty results without errors.
  const result = await linker.linkEntities([]);

  assertEquals(result.length, 0);
  assert(Array.isArray(result));
});

Deno.test("EntityLinker - linkEntities with single entity, no search results", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Test error handling when entity cannot be found in empty knowledge graph.
  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "Alice",
      text: "Alice",
    },
  ];
  // Verify proper error handling when no search results are available.
  await assertRejects(
    async () => await linker.linkEntities(entities),
    Error,
    "No search hits available for disambiguation",
  );
});

Deno.test("EntityLinker - linkEntities with single entity, with search results", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data to verify entity linking works with known entities.
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice",
  });

  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "Alice",
      text: "Alice",
    },
  ];
  const result = await linker.linkEntities(entities);

  // Verify exactly one entity is processed correctly.
  assertEquals(result.length, 1);

  // Verify entity linking produces at least one successful result.
  assert(result.length > 0);

  // Verify the linked entity has the expected structure and properties.
  result.forEach((linkedEntity) => {
    assertExists(linkedEntity.entity);
    assertExists(linkedEntity.entity.text);
    assertExists(linkedEntity.entity.id);
    assertExists(linkedEntity.entity.type);
    assertExists(linkedEntity.entity.name);
    assertExists(linkedEntity.subject);
    assertEquals(typeof linkedEntity.subject, "string");
  });
});

Deno.test("EntityLinker - linkEntities with multiple entities", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data to verify entity linking works with known entities. for multiple entities to verify batch processing.
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

  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "Alice",
      text: "Alice",
    },
    {
      id: "PLACEHOLDER_ENTITY_2",
      type: "schema:Place",
      name: "Central Park",
      text: "Central Park",
    },
  ];
  const result = await linker.linkEntities(entities);

  // Verify both entities are processed in the batch operation.
  assertEquals(result.length, 2);

  // Verify batch entity linking produces successful results.
  assert(result.length > 0);

  // Verify we successfully linked both Alice and Central Park entities.
  const entityTexts = result.map((le) => le.entity.text);
  const hasAlice = entityTexts.some((text) => text.includes("Alice"));
  const hasCentralPark = entityTexts.some((text) =>
    text.includes("Central Park")
  );
  assert(hasAlice);
  assert(hasCentralPark);
});

Deno.test("EntityLinker - linkEntity with no search results", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Create a fake entity that won't be found to test error handling.
  const entity: GeneratedTurtleVariable = {
    id: "PLACEHOLDER_ENTITY_1",
    type: "schema:Person",
    name: "UnknownEntity12345",
    text: "UnknownEntity12345",
  };

  // Verify proper error handling when no search results are available.
  await assertRejects(
    async () => await linker.linkEntity(entity),
    Error,
    "No search hits available for disambiguation",
  );
});

Deno.test("EntityLinker - linkEntity with search results", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data to verify entity linking works with known entities.
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice",
  });

  // Create an entity that should match our test data for successful linking.
  const entity: GeneratedTurtleVariable = {
    id: "PLACEHOLDER_ENTITY_1",
    type: "schema:Person",
    name: "Alice",
    text: "Alice",
  };

  const result = await linker.linkEntity(entity);

  assertExists(result);
  assertEquals(result, "http://example.org/person1");
  assertEquals(typeof result, "string");
});

Deno.test("EntityLinker - integration with real services", async () => {
  // Create real services for integration testing to verify end-to-end functionality.
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert some test data to verify integration with real services.
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

  // Test with entities that should match our data to verify successful linking.
  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "Alice Smith",
      text: "Alice",
    },
    {
      id: "PLACEHOLDER_ENTITY_2",
      type: "schema:Place",
      name: "Central Park",
      text: "Central Park",
    },
  ];
  const result = await linker.linkEntities(entities);

  // Verify both entities are processed in the batch operation.
  assertEquals(result.length, 2);

  // Check that we have some linked entities
  assert(result.length > 0);

  // Verify the linked entity has the expected structure and properties. of linked entities
  result.forEach((linkedEntity) => {
    assertExists(linkedEntity.entity);
    assertExists(linkedEntity.entity.text);
    assertExists(linkedEntity.entity.id);
    assertExists(linkedEntity.entity.type);
    assertExists(linkedEntity.entity.name);
    assertExists(linkedEntity.subject);
    assertEquals(typeof linkedEntity.subject, "string");
  });
});

Deno.test("EntityLinker - handles empty entities", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  const result = await linker.linkEntities([]);

  assertEquals(result.length, 0);
});

Deno.test("EntityLinker - handles entities with special characters", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data to verify entity linking works with known entities. with special characters
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

  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "José María",
      text: "José María",
    },
    {
      id: "PLACEHOLDER_ENTITY_2",
      type: "schema:Person",
      name: "O'Connor-Smith",
      text: "O'Connor-Smith",
    },
  ];
  const result = await linker.linkEntities(entities);

  // Verify both entities are processed in the batch operation.
  assertEquals(result.length, 2);

  // Verify batch entity linking produces successful results.
  assert(result.length > 0);
});

Deno.test("EntityLinker - handles entities with overlapping text", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data to verify entity linking works with known entities.
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

  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Place",
      name: "New York",
      text: "New York",
    },
  ];
  const result = await linker.linkEntities(entities);

  // Verify exactly one entity is processed correctly.
  assertEquals(result.length, 1);

  // Verify batch entity linking produces successful results.
  assert(result.length > 0);
});

Deno.test("EntityLinker - preserves entity information", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data to verify entity linking works with known entities.
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice",
  });
  await insertTriple(store, {
    subject: "http://example.org/person2",
    predicate: "http://schema.org/name",
    object: "Bob",
  });

  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "Alice",
      text: "Alice",
    },
    {
      id: "PLACEHOLDER_ENTITY_2",
      type: "schema:Person",
      name: "Bob",
      text: "Bob",
    },
  ];
  const result = await linker.linkEntities(entities);

  // Verify both entities are processed in the batch operation.
  assertEquals(result.length, 2);

  // Verify entity information is preserved
  result.forEach((linkedEntity) => {
    assertExists(linkedEntity.entity.id);
    assertExists(linkedEntity.entity.type);
    assertExists(linkedEntity.entity.name);
    assertExists(linkedEntity.entity.text);
    assert(linkedEntity.entity.id.length > 0);
    assert(linkedEntity.entity.text.length > 0);
  });
});

Deno.test("EntityLinker - handles concurrent entity linking", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data to verify entity linking works with known entities.
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
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Thing",
      name: "Entity1",
      text: "Entity1",
    }),
    linker.linkEntity({
      id: "PLACEHOLDER_ENTITY_2",
      type: "schema:Thing",
      name: "Entity2",
      text: "Entity2",
    }),
    linker.linkEntity({
      id: "PLACEHOLDER_ENTITY_3",
      type: "schema:Thing",
      name: "Entity3",
      text: "Entity3",
    }),
  ];

  const results = await Promise.all(promises);

  assertEquals(results.length, 3);
  assertEquals(results[0], "http://example.org/1");
  assertEquals(results[1], "http://example.org/2");
  assertEquals(results[2], "http://example.org/3");
});

Deno.test("EntityLinker - handles multiple search results and disambiguation", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

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

  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "Alice",
      text: "Alice",
    },
  ];
  const result = await linker.linkEntities(entities);

  // Verify exactly one entity is processed correctly.
  assertEquals(result.length, 1);

  // Verify batch entity linking produces successful results.
  assert(result.length > 0);

  // Verify disambiguation worked (should return the first/highest scoring result)
  result.forEach((linkedEntity) => {
    assertExists(linkedEntity.subject);
    assertEquals(typeof linkedEntity.subject, "string");
  });
});

Deno.test("EntityLinker - handles case sensitivity", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data to verify entity linking works with known entities. with specific case
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice Smith",
  });

  // Test with different cases
  const entities1: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "Alice",
      text: "Alice",
    },
  ];
  const entities2: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "alice",
      text: "alice",
    },
  ];
  const result1 = await linker.linkEntities(entities1);
  const result2 = await linker.linkEntities(entities2);

  // Both should produce results (Orama is typically case-insensitive)
  assert(result1.length > 0);
  assert(result2.length > 0);

  // Both should have linked entities
  assert(result1.length > 0);
  assert(result2.length > 0);
});
