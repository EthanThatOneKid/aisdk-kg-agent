import { assert, assertEquals } from "@std/assert";
import { DataFactory, Quad, Store } from "n3";
import { exportTurtle, insertTurtle } from "./turtle.ts";

Deno.test("insertTurtle: basic single triple", () => {
  const store = new Store();
  const turtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:person1 rdf:type ex:Person .`;

  insertTurtle(store, turtle);

  assertEquals(store.size, 1);
  const quads = Array.from(store) as Quad[];
  assertEquals(quads[0].subject.value, "http://example.org/person1");
  assertEquals(
    quads[0].predicate.value,
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  );
  assertEquals(quads[0].object.value, "http://example.org/Person");
});

Deno.test("insertTurtle: multiple triples", () => {
  const store = new Store();
  const turtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:person1 rdf:type ex:Person ;
           ex:name "John Doe" ;
           ex:age 30 .`;

  insertTurtle(store, turtle);

  assertEquals(store.size, 3);
  const quads = Array.from(store) as Quad[];

  // Check that all quads have the same subject
  const subjects = quads.map((q) => q.subject.value);
  assert(subjects.every((s) => s === "http://example.org/person1"));

  // Check predicates
  const predicates = quads.map((q) => q.predicate.value);
  assert(
    predicates.includes("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
  );
  assert(predicates.includes("http://example.org/name"));
  assert(predicates.includes("http://example.org/age"));
});

Deno.test("insertTurtle: empty turtle string", () => {
  const store = new Store();
  const turtle = "";

  insertTurtle(store, turtle);

  assertEquals(store.size, 0);
});

Deno.test("insertTurtle: turtle with only prefixes", () => {
  const store = new Store();
  const turtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .`;

  insertTurtle(store, turtle);

  assertEquals(store.size, 0);
});

Deno.test("exportTurtle: basic single triple", async () => {
  const store = new Store();
  const subject = DataFactory.namedNode("http://example.org/person1");
  const predicate = DataFactory.namedNode(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  );
  const object = DataFactory.namedNode("http://example.org/Person");
  const graph = DataFactory.defaultGraph();

  store.addQuad(DataFactory.quad(subject, predicate, object, graph));

  const result = await exportTurtle(store);

  assert(result.includes("http://example.org/person1"));
  assert(result.includes("a")); // N3 Writer uses 'a' shorthand for rdf:type
  assert(result.includes("http://example.org/Person"));
});

Deno.test("exportTurtle: multiple triples", async () => {
  const store = new Store();
  const subject = DataFactory.namedNode("http://example.org/person1");
  const typePredicate = DataFactory.namedNode(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  );
  const namePredicate = DataFactory.namedNode("http://example.org/name");
  const agePredicate = DataFactory.namedNode("http://example.org/age");
  const graph = DataFactory.defaultGraph();

  store.addQuad(
    DataFactory.quad(
      subject,
      typePredicate,
      DataFactory.namedNode("http://example.org/Person"),
      graph,
    ),
  );
  store.addQuad(
    DataFactory.quad(
      subject,
      namePredicate,
      DataFactory.literal("John Doe"),
      graph,
    ),
  );
  store.addQuad(
    DataFactory.quad(subject, agePredicate, DataFactory.literal("30"), graph),
  );

  const result = await exportTurtle(store);

  assert(result.includes("http://example.org/person1"));
  assert(result.includes("a")); // N3 Writer uses 'a' shorthand for rdf:type
  assert(result.includes("http://example.org/Person"));
  assert(result.includes("http://example.org/name"));
  assert(result.includes("John Doe"));
  assert(result.includes("http://example.org/age"));
  assert(result.includes("30"));
});

Deno.test("exportTurtle: empty store", async () => {
  const store = new Store();

  const result = await exportTurtle(store);

  assertEquals(result, "");
});

Deno.test("exportTurtle: round-trip consistency", async () => {
  const originalTurtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:person1 rdf:type ex:Person ;
           ex:name "John Doe" ;
           ex:age 30 .`;

  const store = new Store();
  insertTurtle(store, originalTurtle);

  const exportedTurtle = await exportTurtle(store);

  // Re-parse the exported turtle to verify it's valid
  const newStore = new Store();
  insertTurtle(newStore, exportedTurtle);

  // Both stores should have the same number of quads
  assertEquals(store.size, newStore.size);
  assertEquals(store.size, 3);
});

Deno.test("insertTurtle: malformed turtle throws error", () => {
  const store = new Store();
  const malformedTurtle = `@prefix ex: <http://example.org/> .
ex:person1 ex:name "missing period"`;

  try {
    insertTurtle(store, malformedTurtle);
    assert(
      false,
      "Expected insertTurtle to throw an error for malformed turtle",
    );
  } catch (error) {
    // Expected to throw an error
    assert(error instanceof Error);
  }
});
