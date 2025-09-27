import { assertEquals } from "@std/assert";
import { QueryEngine } from "@comunica/query-sparql-rdfjs-lite";
import * as n3 from "n3";
import { insertTurtle } from "n3store/turtle.ts";
import { SparqlSearchService } from "./search.ts";

Deno.test("SparqlSearchService - search with occurrence-based scoring", async () => {
  const queryEngine = new QueryEngine();

  // Create deterministic test data with different occurrence counts.
  const testData = `
    @prefix ex: <http://example.org/> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix schema: <http://schema.org/> .

    # Person1 appears 5 times with "Alice"
    ex:person1 rdf:type schema:Person ;
               schema:name "Alice" ;
               schema:givenName "Alice" ;
               schema:alternateName "Alice Smith" ;
               schema:description "Alice is a person" ;
               schema:jobTitle "Alice the Developer" .

    # Person2 appears 3 times with "Alice"  
    ex:person2 rdf:type schema:Person ;
               schema:name "Alice Johnson" ;
               schema:givenName "Alice" ;
               schema:description "Alice works here" .

    # Person3 appears 1 time with "Alice"
    ex:person3 rdf:type schema:Person ;
               schema:name "Alice Brown" .
  `;

  // Create N3 store with test data.
  const store = new n3.Store();
  insertTurtle(store, testData);

  const service = new SparqlSearchService(queryEngine, {
    sources: [store],
  });

  const result = await service.search({ text: "Alice" });

  assertEquals(result.text, "Alice");
  assertEquals(result.hits.length, 3);

  // Verify results are ordered by score (occurrence count) in descending order.
  assertEquals(result.hits[0].subject, "http://example.org/person1");
  assertEquals(result.hits[0].score, 5);

  assertEquals(result.hits[1].subject, "http://example.org/person2");
  assertEquals(result.hits[1].score, 3);

  assertEquals(result.hits[2].subject, "http://example.org/person3");
  assertEquals(result.hits[2].score, 1);
});

Deno.test("SparqlSearchService - search with single occurrence", async () => {
  const queryEngine = new QueryEngine();

  const testData = `
    @prefix ex: <http://example.org/> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix schema: <http://schema.org/> .

    ex:person1 rdf:type schema:Person ;
               schema:name "Bob" .
  `;

  const store = new n3.Store();
  insertTurtle(store, testData);

  const service = new SparqlSearchService(queryEngine, {
    sources: [store],
  });

  const result = await service.search({ text: "Bob" });

  assertEquals(result.text, "Bob");
  assertEquals(result.hits.length, 1);
  assertEquals(result.hits[0].subject, "http://example.org/person1");
  assertEquals(result.hits[0].score, 1);
});

Deno.test("SparqlSearchService - search with no results", async () => {
  const queryEngine = new QueryEngine();

  const testData = `
    @prefix ex: <http://example.org/> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix schema: <http://schema.org/> .

    ex:person1 rdf:type schema:Person ;
               schema:name "Alice" .
  `;

  const store = new n3.Store();
  insertTurtle(store, testData);

  const service = new SparqlSearchService(queryEngine, {
    sources: [store],
  });

  const result = await service.search({ text: "NonExistent" });

  assertEquals(result.text, "NonExistent");
  assertEquals(result.hits.length, 0);
});

Deno.test("SparqlSearchService - search with high occurrence counts", async () => {
  const queryEngine = new QueryEngine();

  const testData = `
    @prefix ex: <http://example.org/> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix schema: <http://schema.org/> .

    # Create multiple occurrences for "popular".
    ex:popular rdf:type schema:Thing ;
               schema:name "popular item" ;
               schema:description "This is a popular item" ;
               schema:category "popular category" .
  `;

  const store = new n3.Store();
  insertTurtle(store, testData);

  const service = new SparqlSearchService(queryEngine, {
    sources: [store],
  });

  const result = await service.search({ text: "popular" });

  assertEquals(result.text, "popular");
  assertEquals(result.hits.length, 1);
  assertEquals(result.hits[0].subject, "http://example.org/popular");
  assertEquals(result.hits[0].score, 3); // 3 occurrences of "popular".
});

Deno.test("SparqlSearchService - search with multiple occurrences", async () => {
  const queryEngine = new QueryEngine();

  const testData = `
    @prefix ex: <http://example.org/> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix schema: <http://schema.org/> .

    ex:person1 rdf:type schema:Person ;
               schema:name "Alice" ;
               schema:description "Alice is a person" .
  `;

  const store = new n3.Store();
  insertTurtle(store, testData);

  const service = new SparqlSearchService(queryEngine, {
    sources: [store],
  });

  const result = await service.search({ text: "Alice" });

  assertEquals(result.text, "Alice");
  assertEquals(result.hits.length, 1);
  assertEquals(result.hits[0].subject, "http://example.org/person1");
  assertEquals(result.hits[0].score, 2); // 2 occurrences of "Alice".
});

Deno.test("SparqlSearchService - search preserves text case", async () => {
  const queryEngine = new QueryEngine();

  const testData = `
    @prefix ex: <http://example.org/> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix schema: <http://schema.org/> .

    ex:person1 rdf:type schema:Person ;
               schema:name "Alice" .
  `;

  const store = new n3.Store();
  insertTurtle(store, testData);

  const service = new SparqlSearchService(queryEngine, {
    sources: [store],
  });

  const result = await service.search({ text: "ALICE" });

  assertEquals(result.text, "ALICE");
  assertEquals(result.hits.length, 1);
  assertEquals(result.hits[0].subject, "http://example.org/person1");
  assertEquals(result.hits[0].score, 1);
});
