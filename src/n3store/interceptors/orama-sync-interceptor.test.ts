import { assertEquals, assertExists } from "@std/assert";
import { DataFactory } from "n3";
import { createOramaTripleStore, findTriple } from "src/orama/triple-store.ts";
import { OramaSyncInterceptor } from "./orama-sync-interceptor.ts";

Deno.test("OramaSyncInterceptor: addQuad syncs to Orama store", async () => {
  const oramaStore = createOramaTripleStore();
  const interceptor = new OramaSyncInterceptor(oramaStore);

  // Create a test quad.
  const subject = DataFactory.namedNode("http://example.org/person1");
  const predicate = DataFactory.namedNode(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  );
  const object = DataFactory.namedNode("http://example.org/Person");
  const graph = DataFactory.defaultGraph();
  const quad = DataFactory.quad(subject, predicate, object, graph);

  // Add quad through interceptor.
  await interceptor.addQuad(quad);

  // Verify the triple was added to Orama store.
  const foundId = await findTriple(oramaStore, {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://example.org/Person",
  });

  assertExists(foundId, "Triple should be found in Orama store after addQuad");
});

Deno.test("OramaSyncInterceptor: removeQuad removes from Orama store", async () => {
  const oramaStore = createOramaTripleStore();
  const interceptor = new OramaSyncInterceptor(oramaStore);

  // Create a test quad.
  const subject = DataFactory.namedNode("http://example.org/person1");
  const predicate = DataFactory.namedNode(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  );
  const object = DataFactory.namedNode("http://example.org/Person");
  const graph = DataFactory.defaultGraph();
  const quad = DataFactory.quad(subject, predicate, object, graph);

  // First add the quad.
  await interceptor.addQuad(quad);

  // Verify it was added.
  let foundId = await findTriple(oramaStore, {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://example.org/Person",
  });
  assertExists(foundId, "Triple should exist before removal");

  // Now remove the quad.
  await interceptor.removeQuad(quad);

  // Verify it was removed.
  foundId = await findTriple(oramaStore, {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://example.org/Person",
  });
  assertEquals(foundId, null, "Triple should not be found after removal");
});

Deno.test("OramaSyncInterceptor: handles multiple quads correctly", async () => {
  const oramaStore = createOramaTripleStore();
  const interceptor = new OramaSyncInterceptor(oramaStore);

  // Create multiple test quads.
  const quads = [
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      DataFactory.namedNode("http://example.org/Person"),
      DataFactory.defaultGraph(),
    ),
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://example.org/name"),
      DataFactory.literal("John Doe"),
      DataFactory.defaultGraph(),
    ),
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://example.org/age"),
      DataFactory.literal("30"),
      DataFactory.defaultGraph(),
    ),
  ];

  // Add all quads.
  for (const quad of quads) {
    await interceptor.addQuad(quad);
  }

  // Verify all triples were added.
  const expectedTriples = [
    {
      subject: "http://example.org/person1",
      predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      object: "http://example.org/Person",
    },
    {
      subject: "http://example.org/person1",
      predicate: "http://example.org/name",
      object: "John Doe",
    },
    {
      subject: "http://example.org/person1",
      predicate: "http://example.org/age",
      object: "30",
    },
  ];

  for (const triple of expectedTriples) {
    const foundId = await findTriple(oramaStore, triple);
    assertExists(foundId, `Triple should be found: ${JSON.stringify(triple)}`);
  }
});

Deno.test("OramaSyncInterceptor: handles literal values correctly", async () => {
  const oramaStore = createOramaTripleStore();
  const interceptor = new OramaSyncInterceptor(oramaStore);

  // Create quad with different literal types.
  const stringLiteral = DataFactory.literal("Hello World");
  const numberLiteral = DataFactory.literal(
    "42",
    DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#integer"),
  );
  const booleanLiteral = DataFactory.literal(
    "true",
    DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#boolean"),
  );

  const quads = [
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/resource1"),
      DataFactory.namedNode("http://example.org/stringProp"),
      stringLiteral,
      DataFactory.defaultGraph(),
    ),
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/resource1"),
      DataFactory.namedNode("http://example.org/numberProp"),
      numberLiteral,
      DataFactory.defaultGraph(),
    ),
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/resource1"),
      DataFactory.namedNode("http://example.org/booleanProp"),
      booleanLiteral,
      DataFactory.defaultGraph(),
    ),
  ];

  // Add all quads.
  for (const quad of quads) {
    await interceptor.addQuad(quad);
  }

  // Verify all triples were added with correct literal values.
  const expectedTriples = [
    {
      subject: "http://example.org/resource1",
      predicate: "http://example.org/stringProp",
      object: "Hello World",
    },
    {
      subject: "http://example.org/resource1",
      predicate: "http://example.org/numberProp",
      object: "42",
    },
    {
      subject: "http://example.org/resource1",
      predicate: "http://example.org/booleanProp",
      object: "true",
    },
  ];

  for (const triple of expectedTriples) {
    const foundId = await findTriple(oramaStore, triple);
    assertExists(
      foundId,
      `Literal triple should be found: ${JSON.stringify(triple)}`,
    );
  }
});

Deno.test("OramaSyncInterceptor: handles blank nodes correctly", async () => {
  const oramaStore = createOramaTripleStore();
  const interceptor = new OramaSyncInterceptor(oramaStore);

  // Create quad with blank node.
  const blankNode = DataFactory.blankNode("b1");
  const quad = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://example.org/address"),
    blankNode,
    DataFactory.defaultGraph(),
  );

  // Add quad.
  await interceptor.addQuad(quad);

  // Verify the triple was added with blank node value.
  const foundId = await findTriple(oramaStore, {
    subject: "http://example.org/person1",
    predicate: "http://example.org/address",
    object: "_:b1", // Blank nodes are represented with _: prefix
  });

  assertExists(
    foundId,
    "Triple with blank node should be found in Orama store",
  );
});

Deno.test("OramaSyncInterceptor: handles different graph contexts", async () => {
  const oramaStore = createOramaTripleStore();
  const interceptor = new OramaSyncInterceptor(oramaStore);

  // Create quads with different graph contexts.
  const defaultGraph = DataFactory.defaultGraph();
  const namedGraph = DataFactory.namedNode("http://example.org/graph1");

  const quads = [
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/resource1"),
      DataFactory.namedNode("http://example.org/prop1"),
      DataFactory.literal("value1"),
      defaultGraph,
    ),
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/resource1"),
      DataFactory.namedNode("http://example.org/prop2"),
      DataFactory.literal("value2"),
      namedGraph,
    ),
  ];

  // Add all quads.
  for (const quad of quads) {
    await interceptor.addQuad(quad);
  }

  // Verify both triples were added (graph context is not stored in Orama).
  const expectedTriples = [
    {
      subject: "http://example.org/resource1",
      predicate: "http://example.org/prop1",
      object: "value1",
    },
    {
      subject: "http://example.org/resource1",
      predicate: "http://example.org/prop2",
      object: "value2",
    },
  ];

  for (const triple of expectedTriples) {
    const foundId = await findTriple(oramaStore, triple);
    assertExists(
      foundId,
      `Triple should be found regardless of graph context: ${
        JSON.stringify(triple)
      }`,
    );
  }
});

Deno.test("OramaSyncInterceptor: addQuad and removeQuad are idempotent", async () => {
  const oramaStore = createOramaTripleStore();
  const interceptor = new OramaSyncInterceptor(oramaStore);

  // Create a test quad.
  const quad = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    DataFactory.namedNode("http://example.org/Person"),
    DataFactory.defaultGraph(),
  );

  // Add the same quad multiple times.
  await interceptor.addQuad(quad);
  await interceptor.addQuad(quad);
  await interceptor.addQuad(quad);

  // Verify it exists.
  let foundId = await findTriple(oramaStore, {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://example.org/Person",
  });
  assertExists(foundId, "Triple should exist after multiple adds");

  // Remove the same quad multiple times.
  await interceptor.removeQuad(quad);
  await interceptor.removeQuad(quad);
  await interceptor.removeQuad(quad);

  // Verify it's gone.
  foundId = await findTriple(oramaStore, {
    subject: "http://example.org/person1",
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://example.org/Person",
  });
  assertEquals(foundId, null, "Triple should not exist after multiple removes");
});
