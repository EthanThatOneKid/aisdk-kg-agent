import { assertEquals } from "@std/assert";
import type { OramaTriple } from "./triple-store.ts";
import { OramaSearchService } from "./search.ts";
import { createOramaTripleStore, insertTriple } from "./triple-store.ts";

Deno.test("OramaSearchService - search with empty store", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Search in an empty store should return no hits.
  const result = await service.search({
    text: "any search term",
  });

  assertEquals(result.text, "any search term");
  assertEquals(result.hits.length, 0);
});

Deno.test("OramaSearchService - search with single match", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert a triple with searchable content in the object field.
  const triple: OramaTriple = {
    subject: "http://example.org/person1",
    predicate: "http://schema.org/name",
    object: "Alice Smith",
  };
  await insertTriple(store, triple);

  // Search for the name.
  const result = await service.search({
    text: "Alice",
  });

  assertEquals(result.text, "Alice");
  assertEquals(result.hits.length, 1);
  assertEquals(result.hits[0].subject, "http://example.org/person1");
  assertEquals(result.hits[0].score > 0, true);
});

Deno.test("OramaSearchService - search with multiple matches", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert multiple triples with different subjects but similar object content.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "Alice Smith",
    },
    {
      subject: "http://example.org/person2",
      predicate: "http://schema.org/name",
      object: "Alice Johnson",
    },
    {
      subject: "http://example.org/person3",
      predicate: "http://schema.org/name",
      object: "Bob Smith",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search for "Alice" - should match both Alice Smith and Alice Johnson.
  const result = await service.search({
    text: "Alice",
  });

  assertEquals(result.text, "Alice");
  assertEquals(result.hits.length, 2);

  // Verify both Alice entries are found.
  const subjects = result.hits.map((hit) => hit.subject);
  assertEquals(subjects.includes("http://example.org/person1"), true);
  assertEquals(subjects.includes("http://example.org/person2"), true);

  // Verify scores are positive.
  result.hits.forEach((hit) => {
    assertEquals(hit.score > 0, true);
  });
});

Deno.test("OramaSearchService - search with partial matches", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert triples with various object content.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/book1",
      predicate: "http://schema.org/name",
      object: "The Great Gatsby",
    },
    {
      subject: "http://example.org/book2",
      predicate: "http://schema.org/name",
      object: "Gatsby's Party",
    },
    {
      subject: "http://example.org/author1",
      predicate: "http://schema.org/name",
      object: "F. Scott Fitzgerald",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search for "Gatsby" - should match both books.
  const result = await service.search({
    text: "Gatsby",
  });

  assertEquals(result.text, "Gatsby");
  assertEquals(result.hits.length, 2);

  // Verify both Gatsby entries are found.
  const subjects = result.hits.map((hit) => hit.subject);
  assertEquals(subjects.includes("http://example.org/book1"), true);
  assertEquals(subjects.includes("http://example.org/book2"), true);
});

Deno.test("OramaSearchService - search with no matches", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert some triples.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "Alice Smith",
    },
    {
      subject: "http://example.org/book1",
      predicate: "http://schema.org/name",
      object: "The Great Gatsby",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search for something that doesn't exist.
  const result = await service.search({
    text: "nonexistent term",
  });

  assertEquals(result.text, "nonexistent term");
  assertEquals(result.hits.length, 0);
});

Deno.test("OramaSearchService - search with case sensitivity", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert triples with different cases.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "Alice Smith",
    },
    {
      subject: "http://example.org/person2",
      predicate: "http://schema.org/name",
      object: "alice johnson",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search with different cases.
  const result1 = await service.search({
    text: "Alice",
  });

  const result2 = await service.search({
    text: "alice",
  });

  // Both searches should find matches (Orama is typically case-insensitive).
  assertEquals(result1.hits.length > 0, true);
  assertEquals(result2.hits.length > 0, true);
});

Deno.test("OramaSearchService - search with special characters", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert triples with special characters in object content.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "José María",
    },
    {
      subject: "http://example.org/person2",
      predicate: "http://schema.org/name",
      object: "O'Connor-Smith",
    },
    {
      subject: "http://example.org/book1",
      predicate: "http://schema.org/name",
      object: "The 100-Year-Old Man Who Climbed Out the Window",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search for terms with special characters.
  const result1 = await service.search({
    text: "José",
  });

  const result2 = await service.search({
    text: "O'Connor",
  });

  const result3 = await service.search({
    text: "100-Year-Old",
  });

  assertEquals(result1.hits.length, 1);
  assertEquals(result1.hits[0].subject, "http://example.org/person1");

  assertEquals(result2.hits.length, 1);
  assertEquals(result2.hits[0].subject, "http://example.org/person2");

  assertEquals(result3.hits.length, 1);
  assertEquals(result3.hits[0].subject, "http://example.org/book1");
});

Deno.test("OramaSearchService - search with duplicate subjects", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert multiple triples with the same subject but different objects.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "Alice Smith",
    },
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/description",
      object: "Alice is a software engineer",
    },
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/jobTitle",
      object: "Senior Alice Developer",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search for "Alice" - should find the subject with combined scores.
  const result = await service.search({
    text: "Alice",
  });

  assertEquals(result.text, "Alice");
  assertEquals(result.hits.length, 1);
  assertEquals(result.hits[0].subject, "http://example.org/person1");

  // The score should be positive (may or may not be > 1.0 depending on Orama's scoring).
  assertEquals(result.hits[0].score > 0, true);
});

Deno.test("OramaSearchService - search result sorting", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert triples with different relevance to the search term.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/book1",
      predicate: "http://schema.org/name",
      object: "Alice in Wonderland",
    },
    {
      subject: "http://example.org/book2",
      predicate: "http://schema.org/name",
      object: "Alice",
    },
    {
      subject: "http://example.org/book3",
      predicate: "http://schema.org/description",
      object: "A story about Alice",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search for "Alice".
  const result = await service.search({
    text: "Alice",
  });

  assertEquals(result.text, "Alice");
  assertEquals(result.hits.length, 3);

  // Verify results are sorted by score (highest first).
  for (let i = 1; i < result.hits.length; i++) {
    assertEquals(
      result.hits[i - 1].score >= result.hits[i].score,
      true,
    );
  }
});

Deno.test("OramaSearchService - search with empty text", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert some triples.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "Alice Smith",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search with empty text - Orama may still return some results.
  const result = await service.search({
    text: "",
  });

  assertEquals(result.text, "");
  // Orama may return results even for empty search, so we just verify the structure.
  assertEquals(Array.isArray(result.hits), true);
});

Deno.test("OramaSearchService - search with whitespace", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert triples with content that has whitespace.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "Alice Smith",
    },
    {
      subject: "http://example.org/person2",
      predicate: "http://schema.org/name",
      object: "Bob   Johnson", // Multiple spaces.
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search with whitespace.
  const result1 = await service.search({
    text: "Alice Smith",
  });

  const result2 = await service.search({
    text: "Bob Johnson", // Single space search.
  });

  assertEquals(result1.hits.length, 1);
  assertEquals(result1.hits[0].subject, "http://example.org/person1");

  assertEquals(result2.hits.length, 1);
  assertEquals(result2.hits[0].subject, "http://example.org/person2");
});

Deno.test("OramaSearchService - search with long text", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert triples with long object content.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/book1",
      predicate: "http://schema.org/description",
      object:
        "The Great Gatsby is a 1925 novel by American writer F. Scott Fitzgerald. Set in the Jazz Age on Long Island, the novel follows the mysterious Jay Gatsby and his obsession with the beautiful Daisy Buchanan.",
    },
    {
      subject: "http://example.org/book2",
      predicate: "http://schema.org/description",
      object: "A shorter description about Gatsby and his parties.",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search for terms from the long description.
  const result1 = await service.search({
    text: "Gatsby",
  });

  const result2 = await service.search({
    text: "Jazz Age",
  });

  const result3 = await service.search({
    text: "Daisy Buchanan",
  });

  assertEquals(result1.hits.length, 2);
  assertEquals(result2.hits.length, 1);
  assertEquals(result2.hits[0].subject, "http://example.org/book1");
  assertEquals(result3.hits.length, 1);
  assertEquals(result3.hits[0].subject, "http://example.org/book1");
});

Deno.test("OramaSearchService - search with numeric content", async () => {
  const store = createOramaTripleStore();
  const service = new OramaSearchService(store);

  // Insert triples with numeric content in objects.
  const triples: OramaTriple[] = [
    {
      subject: "http://example.org/book1",
      predicate: "http://schema.org/isbn",
      object: "978-0-7432-7356-5",
    },
    {
      subject: "http://example.org/event1",
      predicate: "http://schema.org/name",
      object: "Event 2024",
    },
    {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/age",
      object: "25",
    },
  ];

  await Promise.all(triples.map((triple) => insertTriple(store, triple)));

  // Search for numeric terms.
  const result1 = await service.search({
    text: "978-0-7432-7356-5",
  });

  const result2 = await service.search({
    text: "2024",
  });

  const result3 = await service.search({
    text: "25",
  });

  assertEquals(result1.hits.length, 1);
  assertEquals(result1.hits[0].subject, "http://example.org/book1");

  assertEquals(result2.hits.length, 1);
  assertEquals(result2.hits[0].subject, "http://example.org/event1");

  assertEquals(result3.hits.length, 1);
  assertEquals(result3.hits[0].subject, "http://example.org/person1");
});
