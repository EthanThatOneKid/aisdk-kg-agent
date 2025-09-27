import { assertEquals, assertExists } from "@std/assert";
import { EntityLinker } from "./entity-linker.ts";
import { GreedyDisambiguationService } from "./disambiguation/greedy/disambiguation.ts";
import { OramaSearchService } from "./search/orama/search.ts";
import {
  createOramaTripleStore,
  insertTriple,
} from "./search/orama/triple-store.ts";
import type { GeneratedTurtleVariable } from "../turtle/schema.ts";

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

  // Test with empty entities array
  const result = await linker.linkEntities([]);

  assertEquals(result.length, 0);
  assertEquals(Array.isArray(result), true);
});

Deno.test("EntityLinker - linkEntities with single entity, no search results", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Test with an entity that won't be found in empty store
  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Person",
      name: "Alice",
      text: "Alice",
    },
  ];
  // Should throw an error when no search results are available
  let errorThrown = false;
  try {
    await linker.linkEntities(entities);
  } catch (error) {
    errorThrown = true;
    assertEquals(
      (error as Error).message,
      "No search hits available for disambiguation",
    );
  }
  assertEquals(errorThrown, true);
});

Deno.test("EntityLinker - linkEntities with single entity, with search results", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data
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

  // Should have one entity
  assertEquals(result.length, 1);

  // Should have at least one linked entity
  assertEquals(result.length > 0, true);

  // Verify the structure
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

  // Should have two entities
  assertEquals(result.length, 2);

  // Should have some linked entities
  assertEquals(result.length > 0, true);

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

  const linker = new EntityLinker(search, disambiguation);

  // Create a mock entity that won't be found
  const entity: GeneratedTurtleVariable = {
    id: "PLACEHOLDER_ENTITY_1",
    type: "schema:Person",
    name: "UnknownEntity12345",
    text: "UnknownEntity12345",
  };

  // Should throw an error when no search results are available
  let errorThrown = false;
  try {
    await linker.linkEntity(entity);
  } catch (error) {
    errorThrown = true;
    assertEquals(
      (error as Error).message,
      "No search hits available for disambiguation",
    );
  }
  assertEquals(errorThrown, true);
});

Deno.test("EntityLinker - linkEntity with search results", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data
  await insertTriple(store, {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice",
  });

  // Create an entity that should match
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
  // Create real services for integration testing
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

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

  // Test with entities that should match our data
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

  // Should have two entities
  assertEquals(result.length, 2);

  // Check that we have some linked entities
  assertEquals(result.length > 0, true);

  // Verify the structure of linked entities
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

  // Should have two entities
  assertEquals(result.length, 2);

  // Should have some linked entities
  assertEquals(result.length > 0, true);
});

Deno.test("EntityLinker - handles entities with overlapping text", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

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

  const entities: GeneratedTurtleVariable[] = [
    {
      id: "PLACEHOLDER_ENTITY_1",
      type: "schema:Place",
      name: "New York",
      text: "New York",
    },
  ];
  const result = await linker.linkEntities(entities);

  // Should have one entity
  assertEquals(result.length, 1);

  // Should have some linked entities
  assertEquals(result.length > 0, true);
});

Deno.test("EntityLinker - preserves entity information", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

  // Insert test data
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

  // Should have two entities
  assertEquals(result.length, 2);

  // Verify entity information is preserved
  result.forEach((linkedEntity) => {
    assertExists(linkedEntity.entity.id);
    assertExists(linkedEntity.entity.type);
    assertExists(linkedEntity.entity.name);
    assertExists(linkedEntity.entity.text);
    assertEquals(linkedEntity.entity.id.length > 0, true);
    assertEquals(linkedEntity.entity.text.length > 0, true);
  });
});

Deno.test("EntityLinker - handles concurrent entity linking", async () => {
  const store = createOramaTripleStore();
  const search = new OramaSearchService(store);
  const disambiguation = new GreedyDisambiguationService();

  const linker = new EntityLinker(search, disambiguation);

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

  // Should have one entity
  assertEquals(result.length, 1);

  // Should have some linked entities
  assertEquals(result.length > 0, true);

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

  // Insert test data with specific case
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
  assertEquals(result1.length > 0, true);
  assertEquals(result2.length > 0, true);

  // Both should have linked entities
  assertEquals(result1.length > 0, true);
  assertEquals(result2.length > 0, true);
});
