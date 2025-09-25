import { assertEquals, assertExists } from "@std/assert";
import type { OramaTriple } from "./triple-store.ts";
import {
  createOramaTripleStore,
  findTriple,
  insertTriple,
  removeTriple,
} from "./triple-store.ts";

Deno.test("OramaTripleStore - createOramaTripleStore", async () => {
  const store = await createOramaTripleStore();

  // Verify the store is created successfully.
  assertExists(store);
  assertEquals(typeof store, "object");

  // Verify the store has the expected schema properties.
  assertEquals(store.schema.subject, "string");
  assertEquals(store.schema.predicate, "string");
  assertEquals(store.schema.object, "string");
});

Deno.test("OramaTripleStore - insertTriple", async () => {
  const store = await createOramaTripleStore();
  const triple: OramaTriple = {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://schema.org/Person",
  };

  // Insert a triple and verify it returns an ID.
  const id = await insertTriple(store, triple);
  assertExists(id);
  assertEquals(typeof id, "string");
  assertEquals(id.length > 0, true);
});

Deno.test("OramaTripleStore - insertTriple with multiple triples", async () => {
  const store = await createOramaTripleStore();
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/person1",
      predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      object: "http://schema.org/Person",
    },
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "Alice",
    },
    {
      subject: "http://example.org/person2",
      predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      object: "http://schema.org/Person",
    },
  ];

  // Insert multiple triples and verify each returns a unique ID.
  const ids = await Promise.all(
    triples.map((triple) => insertTriple(store, triple)),
  );

  assertEquals(ids.length, 3);
  ids.forEach((id) => {
    assertExists(id);
    assertEquals(typeof id, "string");
  });

  // Verify all IDs are unique.
  const uniqueIds = new Set(ids);
  assertEquals(uniqueIds.size, 3);
});

Deno.test("OramaTripleStore - findTriple with existing triple", async () => {
  const store = await createOramaTripleStore();
  const triple: OramaTriple = {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://schema.org/Person",
  };

  // Insert the triple first.
  await insertTriple(store, triple);

  // Find the triple and verify it returns the correct ID.
  const foundId = await findTriple(store, triple);
  assertExists(foundId);
  assertEquals(typeof foundId, "string");
});

Deno.test("OramaTripleStore - findTriple with non-existing triple", async () => {
  const store = await createOramaTripleStore();
  const triple: OramaTriple = {
    subject: "http://example.org/nonexistent",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://schema.org/Person",
  };

  // Try to find a non-existing triple.
  const foundId = await findTriple(store, triple);
  assertEquals(foundId, null);
});

Deno.test("OramaTripleStore - findTriple with partial matches", async () => {
  const store = await createOramaTripleStore();
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/person1",
      predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      object: "http://schema.org/Person",
    },
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "Alice",
    },
    {
      subject: "http://example.org/person2",
      predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      object: "http://schema.org/Person",
    },
  ];

  // Insert multiple triples.
  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Find a specific triple that exists.
  const foundId = await findTriple(store, triples[0]);
  assertExists(foundId);

  // Try to find a triple with completely different subject, predicate, and object.
  const nonExistentTriple: OramaTriple = {
    subject: "http://example.org/nonexistent",
    predicate: "http://schema.org/name",
    object: "NonExistent",
  };
  const notFoundId = await findTriple(store, nonExistentTriple);
  assertEquals(notFoundId, null);
});

Deno.test("OramaTripleStore - removeTriple with existing triple", async () => {
  const store = await createOramaTripleStore();
  const triple: OramaTriple = {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://schema.org/Person",
  };

  // Insert the triple first.
  const insertId = await insertTriple(store, triple);

  // Remove the triple and verify it returns the same ID.
  const removeId = await removeTriple(store, triple);
  assertEquals(removeId, insertId);

  // Verify the triple is no longer findable.
  const foundId = await findTriple(store, triple);
  assertEquals(foundId, null);
});

Deno.test("OramaTripleStore - removeTriple with non-existing triple", async () => {
  const store = await createOramaTripleStore();
  const triple: OramaTriple = {
    subject: "http://example.org/nonexistent",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://schema.org/Person",
  };

  // Try to remove a non-existing triple.
  const removeId = await removeTriple(store, triple);
  assertEquals(removeId, null);
});

Deno.test("OramaTripleStore - complex scenario with multiple operations", async () => {
  const store = await createOramaTripleStore();

  // Define a set of related triples.
  const personTriples: OramaTriple[] = [
    {
      subject: "http://example.org/alice",
      predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      object: "http://schema.org/Person",
    },
    {
      subject: "http://example.org/alice",
      predicate: "http://schema.org/name",
      object: "Alice Smith",
    },
    {
      subject: "http://example.org/alice",
      predicate: "http://schema.org/email",
      object: "alice@example.org",
    },
  ];

  const eventTriples: OramaTriple[] = [
    {
      subject: "http://example.org/event1",
      predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      object: "http://schema.org/Event",
    },
    {
      subject: "http://example.org/event1",
      predicate: "http://schema.org/name",
      object: "Tech Conference 2024",
    },
    {
      subject: "http://example.org/event1",
      predicate: "http://schema.org/attendee",
      object: "http://example.org/alice",
    },
  ];

  // Insert all triples.
  const allTriples = [...personTriples, ...eventTriples];
  const insertIds = await Promise.all(
    allTriples.map((triple) => insertTriple(store, triple)),
  );

  // Verify all insertions succeeded.
  assertEquals(insertIds.length, 6);
  insertIds.forEach((id) => {
    assertExists(id);
    assertEquals(typeof id, "string");
  });

  // Verify all triples can be found.
  const foundIds = await Promise.all(
    allTriples.map((triple) => findTriple(store, triple)),
  );
  foundIds.forEach((id) => {
    assertExists(id);
    assertEquals(typeof id, "string");
  });

  // Remove some triples.
  const triplesToRemove = [personTriples[1], eventTriples[0]]; // Remove name and event type.
  const removeIds = await Promise.all(
    triplesToRemove.map((triple) => removeTriple(store, triple)),
  );

  // Verify removals succeeded.
  removeIds.forEach((id) => {
    assertExists(id);
    assertEquals(typeof id, "string");
  });

  // Verify remaining triples are still findable.
  const remainingTriples = allTriples.filter(
    (triple) => !triplesToRemove.includes(triple),
  );
  const remainingFoundIds = await Promise.all(
    remainingTriples.map((triple) => findTriple(store, triple)),
  );
  remainingFoundIds.forEach((id) => {
    assertExists(id);
    assertEquals(typeof id, "string");
  });
});

Deno.test("OramaTripleStore - edge cases with special characters", async () => {
  const store = await createOramaTripleStore();

  // Test with IRIs containing special characters.
  const specialTriples: OramaTriple[] = [
    {
      subject: "http://example.org/person#fragment",
      predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      object: "http://schema.org/Person",
    },
    {
      subject: "http://example.org/person?query=value",
      predicate: "http://schema.org/name",
      object: "John O'Connor-Smith",
    },
    {
      subject: "http://example.org/path/to/resource",
      predicate: "http://schema.org/description",
      object: "A resource with spaces and special chars: !@#$%^&*()",
    },
  ];

  // Insert triples with special characters.
  const insertIds = await Promise.all(
    specialTriples.map((triple) => insertTriple(store, triple)),
  );

  // Verify all insertions succeeded.
  assertEquals(insertIds.length, 3);
  insertIds.forEach((id) => {
    assertExists(id);
    assertEquals(typeof id, "string");
  });

  // Verify all triples can be found.
  const foundIds = await Promise.all(
    specialTriples.map((triple) => findTriple(store, triple)),
  );
  foundIds.forEach((id) => {
    assertExists(id);
    assertEquals(typeof id, "string");
  });
});

Deno.test("OramaTripleStore - duplicate triple handling", async () => {
  const store = await createOramaTripleStore();
  const triple: OramaTriple = {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://schema.org/Person",
  };

  // Insert the same triple multiple times.
  const id1 = await insertTriple(store, triple);
  const id2 = await insertTriple(store, triple);
  const id3 = await insertTriple(store, triple);

  // Verify all insertions return different IDs (Orama allows duplicates).
  assertEquals(id1 !== id2, true);
  assertEquals(id2 !== id3, true);
  assertEquals(id1 !== id3, true);

  // Verify all instances can be found.
  const foundId1 = await findTriple(store, triple);
  assertExists(foundId1);

  // Remove one instance.
  const removeId = await removeTriple(store, triple);
  assertExists(removeId);

  // Verify another instance can still be found.
  const foundId2 = await findTriple(store, triple);
  assertExists(foundId2);
});

Deno.test("OramaTripleStore - empty store operations", async () => {
  const store = await createOramaTripleStore();
  const triple: OramaTriple = {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://schema.org/Person",
  };

  // Try to find a triple in an empty store.
  const foundId = await findTriple(store, triple);
  assertEquals(foundId, null);

  // Try to remove a triple from an empty store.
  const removeId = await removeTriple(store, triple);
  assertEquals(removeId, null);

  // Insert a triple into an empty store.
  const insertId = await insertTriple(store, triple);
  assertExists(insertId);

  // Verify the triple can now be found.
  const foundIdAfterInsert = await findTriple(store, triple);
  assertEquals(foundIdAfterInsert, insertId);
});
