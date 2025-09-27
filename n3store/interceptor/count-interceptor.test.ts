import { assertEquals } from "@std/assert";
import { DataFactory } from "n3";
import { CountInterceptor } from "./count-interceptor.ts";

Deno.test("CountInterceptor: initial counts are zero", () => {
  const interceptor = new CountInterceptor();

  assertEquals(interceptor.added, 0, "Initial added count should be zero");
  assertEquals(interceptor.removed, 0, "Initial removed count should be zero");
});

Deno.test("CountInterceptor: addQuad increments added count", () => {
  const interceptor = new CountInterceptor();

  // Create a test quad.
  const quad = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    DataFactory.namedNode("http://example.org/Person"),
    DataFactory.defaultGraph(),
  );

  // Add the quad.
  interceptor.addQuad(quad);

  assertEquals(
    interceptor.added,
    1,
    "Added count should be 1 after one addQuad",
  );
  assertEquals(interceptor.removed, 0, "Removed count should remain 0");
});

Deno.test("CountInterceptor: removeQuad increments removed count", () => {
  const interceptor = new CountInterceptor();

  // Create a test quad.
  const quad = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    DataFactory.namedNode("http://example.org/Person"),
    DataFactory.defaultGraph(),
  );

  // Remove the quad.
  interceptor.removeQuad(quad);

  assertEquals(interceptor.added, 0, "Added count should remain 0");
  assertEquals(
    interceptor.removed,
    1,
    "Removed count should be 1 after one removeQuad",
  );
});

Deno.test("CountInterceptor: multiple addQuad calls increment count correctly", () => {
  const interceptor = new CountInterceptor();

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
    interceptor.addQuad(quad);
  }

  assertEquals(
    interceptor.added,
    3,
    "Added count should be 3 after adding 3 quads",
  );
  assertEquals(interceptor.removed, 0, "Removed count should remain 0");
});

Deno.test("CountInterceptor: multiple removeQuad calls increment count correctly", () => {
  const interceptor = new CountInterceptor();

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

  // Remove all quads.
  for (const quad of quads) {
    interceptor.removeQuad(quad);
  }

  assertEquals(interceptor.added, 0, "Added count should remain 0");
  assertEquals(
    interceptor.removed,
    3,
    "Removed count should be 3 after removing 3 quads",
  );
});

Deno.test("CountInterceptor: mixed add and remove operations", () => {
  const interceptor = new CountInterceptor();

  // Create test quads.
  const quad1 = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    DataFactory.namedNode("http://example.org/Person"),
    DataFactory.defaultGraph(),
  );

  const quad2 = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://example.org/name"),
    DataFactory.literal("John Doe"),
    DataFactory.defaultGraph(),
  );

  const quad3 = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://example.org/age"),
    DataFactory.literal("30"),
    DataFactory.defaultGraph(),
  );

  // Perform mixed operations.
  interceptor.addQuad(quad1);
  interceptor.addQuad(quad2);
  interceptor.removeQuad(quad1);
  interceptor.addQuad(quad3);
  interceptor.removeQuad(quad2);
  interceptor.removeQuad(quad3);

  assertEquals(
    interceptor.added,
    3,
    "Added count should be 3 (3 add operations)",
  );
  assertEquals(
    interceptor.removed,
    3,
    "Removed count should be 3 (3 remove operations)",
  );
});

Deno.test("CountInterceptor: handles different quad types correctly", () => {
  const interceptor = new CountInterceptor();

  // Create quads with different types of objects.
  const quads = [
    // Named node object.
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      DataFactory.namedNode("http://example.org/Person"),
      DataFactory.defaultGraph(),
    ),
    // Literal object.
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://example.org/name"),
      DataFactory.literal("John Doe"),
      DataFactory.defaultGraph(),
    ),
    // Blank node object.
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://example.org/address"),
      DataFactory.blankNode("b1"),
      DataFactory.defaultGraph(),
    ),
    // Typed literal.
    DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://example.org/age"),
      DataFactory.literal(
        "30",
        DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#integer"),
      ),
      DataFactory.defaultGraph(),
    ),
  ];

  // Add all quads.
  for (const quad of quads) {
    interceptor.addQuad(quad);
  }

  assertEquals(
    interceptor.added,
    4,
    "Added count should be 4 for all quad types",
  );
  assertEquals(interceptor.removed, 0, "Removed count should remain 0");

  // Remove all quads.
  for (const quad of quads) {
    interceptor.removeQuad(quad);
  }

  assertEquals(interceptor.added, 4, "Added count should remain 4");
  assertEquals(
    interceptor.removed,
    4,
    "Removed count should be 4 for all quad types",
  );
});

Deno.test("CountInterceptor: handles different graph contexts", () => {
  const interceptor = new CountInterceptor();

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
    interceptor.addQuad(quad);
  }

  assertEquals(
    interceptor.added,
    2,
    "Added count should be 2 for different graph contexts",
  );
  assertEquals(interceptor.removed, 0, "Removed count should remain 0");

  // Remove all quads.
  for (const quad of quads) {
    interceptor.removeQuad(quad);
  }

  assertEquals(interceptor.added, 2, "Added count should remain 2");
  assertEquals(
    interceptor.removed,
    2,
    "Removed count should be 2 for different graph contexts",
  );
});

Deno.test("CountInterceptor: same quad can be added and removed multiple times", () => {
  const interceptor = new CountInterceptor();

  // Create a test quad.
  const quad = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    DataFactory.namedNode("http://example.org/Person"),
    DataFactory.defaultGraph(),
  );

  // Add the same quad multiple times.
  interceptor.addQuad(quad);
  interceptor.addQuad(quad);
  interceptor.addQuad(quad);

  assertEquals(
    interceptor.added,
    3,
    "Added count should be 3 for same quad added 3 times",
  );
  assertEquals(interceptor.removed, 0, "Removed count should remain 0");

  // Remove the same quad multiple times.
  interceptor.removeQuad(quad);
  interceptor.removeQuad(quad);
  interceptor.removeQuad(quad);

  assertEquals(interceptor.added, 3, "Added count should remain 3");
  assertEquals(
    interceptor.removed,
    3,
    "Removed count should be 3 for same quad removed 3 times",
  );
});

Deno.test("CountInterceptor: counts are independent", () => {
  const interceptor = new CountInterceptor();

  // Create test quads.
  const quad1 = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    DataFactory.namedNode("http://example.org/Person"),
    DataFactory.defaultGraph(),
  );

  const quad2 = DataFactory.quad(
    DataFactory.namedNode("http://example.org/person1"),
    DataFactory.namedNode("http://example.org/name"),
    DataFactory.literal("John Doe"),
    DataFactory.defaultGraph(),
  );

  // Add quad1, remove quad2 (which was never added).
  interceptor.addQuad(quad1);
  interceptor.removeQuad(quad2);

  assertEquals(
    interceptor.added,
    1,
    "Added count should be 1 (quad1 was added)",
  );
  assertEquals(
    interceptor.removed,
    1,
    "Removed count should be 1 (quad2 removal was counted)",
  );

  // Add quad2, remove quad1.
  interceptor.addQuad(quad2);
  interceptor.removeQuad(quad1);

  assertEquals(
    interceptor.added,
    2,
    "Added count should be 2 (both quads were added)",
  );
  assertEquals(
    interceptor.removed,
    2,
    "Removed count should be 2 (both quads were removed)",
  );
});
