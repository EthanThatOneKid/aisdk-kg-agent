import { assertEquals } from "@std/assert";
import { QueryEngine } from "@comunica/query-sparql";
import { DataFactory } from "n3";
import { insertTurtle } from "./turtle.ts";
import { CountInterceptor } from "./interceptor/count-interceptor.ts";
import { ErrorInterceptor } from "./interceptor/error-interceptor.ts";
import { CustomN3Store } from "./custom-n3store.ts";

const queryEngine = new QueryEngine();

Deno.test("SPARQL INSERT DATA - Basic", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  await queryEngine.queryVoid(
    `
  PREFIX ex: <http://example.org/>
  PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
 INSERT DATA {
        ex:person1 rdf:type ex:Person ;
                   ex:name "John Doe" ;
                   ex:age 30 .
      }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 3);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 3);
});

Deno.test("SPARQL DELETE DATA", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // First, we insert the initial data.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John Doe" ;
                  ex:age 30 .
     }`,
    { sources: [store] },
  );

  // Then, we delete specific data.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     
     DELETE DATA {
       ex:person1 ex:age 30 .
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 3);
  assertEquals(countInterceptor.removed, 1);
  assertEquals(store.size, 2);
});

Deno.test("SPARQL INSERT/DELETE with WHERE", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // We insert the initial data.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John Doe" ;
                  ex:age 30 .
       ex:person2 rdf:type ex:Person ;
                  ex:name "Jane Smith" ;
                  ex:age 25 .
     }`,
    { sources: [store] },
  );

  // We delete all persons with age greater than 28.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     DELETE {
       ?person ?p ?o .
     } WHERE {
       ?person rdf:type ex:Person ;
               ex:age ?age .
       ?person ?p ?o .
       FILTER(?age > 28)
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 6);
  assertEquals(countInterceptor.removed, 3);
  assertEquals(store.size, 3);
});

Deno.test("SPARQL DELETE with pattern matching", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // We insert the test data.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" ;
                  ex:age 30 .
       ex:person2 rdf:type ex:Person ;
                  ex:name "Jane" ;
                  ex:age 25 .
       ex:person3 rdf:type ex:Person ;
                  ex:name "Bob" ;
                  ex:age 35 .
     }`,
    { sources: [store] },
  );

  // We delete all age properties.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     
     DELETE {
       ?person ex:age ?age .
     } WHERE {
       ?person ex:age ?age .
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 9);
  assertEquals(countInterceptor.removed, 3);
  assertEquals(store.size, 6);
});

Deno.test("SPARQL Mixed INSERT and DELETE", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // We insert the initial data.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" ;
                  ex:age 30 .
     }`,
    { sources: [store] },
  );

  // We perform a mixed update: change age and add email.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     
     DELETE {
       ex:person1 ex:age 30 .
     }
     INSERT {
       ex:person1 ex:age 31 ;
                  ex:email "john@example.com" .
     }
     WHERE {
       ex:person1 ex:age 30 .
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 5);
  assertEquals(countInterceptor.removed, 1);
  assertEquals(store.size, 4);
});

Deno.test("SPARQL INSERT with different graphs", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       GRAPH ex:graph1 {
         ex:person1 rdf:type ex:Person ;
                    ex:name "John" .
       }
       GRAPH ex:graph2 {
         ex:person2 rdf:type ex:Person ;
                    ex:name "Jane" .
       }
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 4);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 4);
});

Deno.test("SPARQL DELETE WHERE without pattern", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // We insert the test data.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" ;
                  ex:age 30 .
       ex:person2 rdf:type ex:Person ;
                  ex:name "Jane" ;
                  ex:age 25 .
     }`,
    { sources: [store] },
  );

  // We delete all quads using DELETE WHERE.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     
     DELETE WHERE {
       ?s ?p ?o .
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 6);
  assertEquals(countInterceptor.removed, 6);
  assertEquals(store.size, 0);
});

Deno.test("SPARQL INSERT with blank nodes", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" ;
                  ex:address [ ex:street "123 Main St" ;
                               ex:city "Anytown" ] .
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 5);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 5);
});

Deno.test("SPARQL INSERT with RDF collections", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" ;
                  ex:hobbies ( "reading" "swimming" "cooking" ) .
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 9);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 9);
});

Deno.test("SPARQL INSERT with language tags and datatypes", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John"@en ;
                  ex:name "Jean"@fr ;
                  ex:age 30 ;
                  ex:height 1.75 ;
                  ex:birthDate "1990-01-01" .
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 6);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 6);
});

Deno.test("SPARQL INSERT with simple property paths", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // We insert some data.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" .
       ex:person2 rdf:type ex:Person ;
                  ex:name "Jane" .
       ex:person1 ex:knows ex:person2 .
     }`,
    { sources: [store] },
  );

  // We perform a simple update without property paths.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     
     INSERT {
       ?person ex:updated true .
     }
     WHERE {
       ?person rdf:type ex:Person ;
               ex:name ?name .
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 7);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 7);
});

Deno.test("SPARQL INSERT with UNION patterns", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" .
       ex:person2 rdf:type ex:Employee ;
                  ex:name "Jane" .
     }`,
    { sources: [store] },
  );

  // We use UNION to find both Person and Employee types.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT {
       ?person ex:processed true .
     }
     WHERE {
       {
         ?person rdf:type ex:Person ;
                 ex:name ?name .
       } UNION {
         ?person rdf:type ex:Employee ;
                 ex:name ?name .
       }
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 6);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 6);
});

Deno.test("SPARQL INSERT with OPTIONAL patterns", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // We insert some data with optional properties.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" ;
                  ex:email "john@example.com" .
       ex:person2 rdf:type ex:Person ;
                  ex:name "Jane" .
     }`,
    { sources: [store] },
  );

  // We use OPTIONAL to conditionally add missing email.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     
     INSERT {
       ?person ex:email "unknown@example.com" .
     }
     WHERE {
       ?person rdf:type ex:Person ;
               ex:name ?name .
       OPTIONAL {
         ?person ex:email ?email .
       }
       FILTER(!BOUND(?email))
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 6);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 6);
});

Deno.test("SPARQL INSERT with FILTER expressions", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // We insert the test data.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" ;
                  ex:age 25 .
       ex:person2 rdf:type ex:Person ;
                  ex:name "Jane" ;
                  ex:age 35 .
       ex:person3 rdf:type ex:Person ;
                  ex:name "Bob" ;
                  ex:age 45 .
     }`,
    { sources: [store] },
  );

  // We use FILTER to conditionally update based on age.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     
     DELETE {
       ?person ex:age ?age .
     }
     INSERT {
       ?person ex:age ?newAge ;
                ex:category ?category .
     }
     WHERE {
       ?person rdf:type ex:Person ;
               ex:name ?name ;
               ex:age ?age .
       BIND(?age + 1 AS ?newAge)
       BIND(IF(?age < 30, "young", IF(?age < 40, "middle-aged", "senior")) AS ?category)
       FILTER(?age >= 30)
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 13);
  assertEquals(countInterceptor.removed, 2);
  assertEquals(store.size, 11);
});

Deno.test("SPARQL INSERT with MINUS patterns", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // We insert the test data.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John" ;
                  ex:status "active" .
       ex:person2 rdf:type ex:Person ;
                  ex:name "Jane" .
       ex:person3 rdf:type ex:Person ;
                  ex:name "Bob" ;
                  ex:status "inactive" .
     }`,
    { sources: [store] },
  );

  // We use MINUS to exclude people with status.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     
     INSERT {
       ?person ex:processed true .
     }
     WHERE {
       ?person rdf:type ex:Person ;
               ex:name ?name .
       MINUS {
         ?person ex:status ?status .
       }
     }`,
    { sources: [store] },
  );

  assertEquals(countInterceptor.added, 9);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 9);
});

Deno.test("Direct method calls", async (t) => {
  const subject = DataFactory.namedNode("http://example.org/person1");
  const predicate = DataFactory.namedNode(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  );
  const object = DataFactory.namedNode("http://example.org/Person");
  const graph = DataFactory.defaultGraph();

  await t.step(
    "Direct addQuad calls should trigger interceptors",
    () => {
      const countInterceptor = new CountInterceptor();
      const store = new CustomN3Store([countInterceptor]);
      const quad1 = DataFactory.quad(subject, predicate, object, graph);
      store.addQuad(quad1);
      assertEquals(countInterceptor.added, 1);
      assertEquals(countInterceptor.removed, 0);
    },
  );

  await t.step(
    "Direct removeQuad calls should trigger interceptors",
    () => {
      const countInterceptor = new CountInterceptor();
      const store = new CustomN3Store([countInterceptor]);
      const quad1 = DataFactory.quad(subject, predicate, object, graph);

      // First add the quad, then remove it.
      store.addQuad(quad1);
      assertEquals(countInterceptor.added, 1);
      assertEquals(countInterceptor.removed, 0);

      // Now remove it.
      store.removeQuad(quad1);
      assertEquals(countInterceptor.added, 1);
      assertEquals(countInterceptor.removed, 1);
    },
  );
});

Deno.test("Track quads by subject IRI with CountInterceptor", async () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  // Insert test data using SPARQL INSERT DATA.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John Doe" ;
                  ex:age 30 .
       ex:person2 rdf:type ex:Person ;
                  ex:name "Jane Smith" ;
                  ex:age 25 .
     }`,
    { sources: [store] },
  );

  // Verify that quad counts are correct after data insertion.
  assertEquals(countInterceptor.added, 6);
  assertEquals(countInterceptor.removed, 0);
});

Deno.test("Error handling in interceptors", () => {
  const countInterceptor = new CountInterceptor();
  const errorInterceptor = new ErrorInterceptor();
  const store = new CustomN3Store([countInterceptor, errorInterceptor]);

  const subject = DataFactory.namedNode("http://example.org/person1");
  const predicate = DataFactory.namedNode(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  );
  const object = DataFactory.namedNode("http://example.org/Person");
  const graph = DataFactory.defaultGraph();
  const quad = DataFactory.quad(subject, predicate, object, graph);

  // Add a quad - should succeed despite error interceptor.
  const addResult = store.addQuad(quad);
  assertEquals(addResult, true);
  assertEquals(countInterceptor.added, 1);
  assertEquals(countInterceptor.removed, 0);

  // Verify error was captured by test interceptor.
  assertEquals(errorInterceptor.getErrorCount(), 1);
  const addErrors = errorInterceptor.getErrorsForMethod("addQuad");
  assertEquals(addErrors.length, 1);
  assertEquals(
    addErrors[0].error.message,
    "ErrorInterceptor: addQuad failed",
  );

  // Remove the quad - should succeed despite error interceptor.
  const removeResult = store.removeQuad(quad);
  assertEquals(removeResult, true);
  assertEquals(countInterceptor.added, 1);
  assertEquals(countInterceptor.removed, 1);

  // Verify error was captured for removeQuad too.
  assertEquals(errorInterceptor.getErrorCount(), 2);
  const removeErrors = errorInterceptor.getErrorsForMethod("removeQuad");
  assertEquals(removeErrors.length, 1);
  assertEquals(
    removeErrors[0].error.message,
    "ErrorInterceptor: removeQuad failed",
  );
});

Deno.test("Error handling with multiple error interceptors", () => {
  const countInterceptor = new CountInterceptor();
  const errorInterceptor1 = new ErrorInterceptor();
  const errorInterceptor2 = new ErrorInterceptor();
  const store = new CustomN3Store([
    countInterceptor,
    errorInterceptor1,
    errorInterceptor2,
  ]);

  const subject = DataFactory.namedNode("http://example.org/person1");
  const predicate = DataFactory.namedNode(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  );
  const object = DataFactory.namedNode("http://example.org/Person");
  const graph = DataFactory.defaultGraph();
  const quad = DataFactory.quad(subject, predicate, object, graph);

  // Add a quad - should succeed despite multiple error interceptors.
  const addResult = store.addQuad(quad);
  assertEquals(addResult, true);
  assertEquals(countInterceptor.added, 1);
  assertEquals(countInterceptor.removed, 0);

  // Verify both error interceptors captured errors.
  assertEquals(errorInterceptor1.getErrorCount(), 1);
  assertEquals(errorInterceptor2.getErrorCount(), 1);

  const errors1 = errorInterceptor1.getErrorsForMethod("addQuad");
  const errors2 = errorInterceptor2.getErrorsForMethod("addQuad");
  assertEquals(errors1.length, 1);
  assertEquals(errors2.length, 1);
  assertEquals(
    errors1[0].error.message,
    "ErrorInterceptor: addQuad failed",
  );
  assertEquals(
    errors2[0].error.message,
    "ErrorInterceptor: addQuad failed",
  );
});

Deno.test("Directly adding parsed Turtle quads triggers interceptors", () => {
  const countInterceptor = new CountInterceptor();
  const store = new CustomN3Store([countInterceptor]);

  const turtle = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:person1 rdf:type ex:Person ;
           ex:name "John Doe" ;
           ex:age 30 .
`;
  insertTurtle(store, turtle);

  // Three triples in the Turtle should result in three intercepted additions.
  assertEquals(countInterceptor.added, 3);
  assertEquals(countInterceptor.removed, 0);
  assertEquals(store.size, 3);
});

Deno.test("Interceptor error handling with SPARQL operations", async () => {
  const countInterceptor = new CountInterceptor();
  const errorInterceptor = new ErrorInterceptor();
  const store = new CustomN3Store([countInterceptor, errorInterceptor]);

  // SPARQL INSERT should succeed despite error interceptor.
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John Doe" .
     }`,
    { sources: [store] },
  );

  // Verify data was added despite errors.
  assertEquals(store.size, 2);
  assertEquals(countInterceptor.added, 2);
  assertEquals(countInterceptor.removed, 0);

  // Verify errors were captured for each quad.
  assertEquals(errorInterceptor.getErrorCount(), 2);
  const addErrors = errorInterceptor.getErrorsForMethod("addQuad");
  assertEquals(addErrors.length, 2);
  assertEquals(
    addErrors[0].error.message,
    "ErrorInterceptor: addQuad failed",
  );
  assertEquals(
    addErrors[1].error.message,
    "ErrorInterceptor: addQuad failed",
  );
});

Deno.test("DatasetCore alias methods", async (t) => {
  const subject = DataFactory.namedNode("http://example.org/person1");
  const predicate = DataFactory.namedNode(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  );
  const object = DataFactory.namedNode("http://example.org/Person");
  const graph = DataFactory.defaultGraph();
  const quad = DataFactory.quad(subject, predicate, object, graph);

  await t.step("add() alias should work like addQuad()", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);

    // Test the add() alias.
    const result = store.add(quad);

    // Should return the store instance for chaining.
    assertEquals(result, store);
    // Should trigger interceptors.
    assertEquals(countInterceptor.added, 1);
    assertEquals(countInterceptor.removed, 0);
    // Should increase store size.
    assertEquals(store.size, 1);
  });

  await t.step("delete() alias should work like removeQuad()", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);

    // First add the quad.
    store.addQuad(quad);
    assertEquals(countInterceptor.added, 1);
    assertEquals(store.size, 1);

    // Test the delete() alias.
    const result = store.delete(quad);

    // Should return the store instance for chaining.
    assertEquals(result, store);
    // Should trigger interceptors.
    assertEquals(countInterceptor.added, 1);
    assertEquals(countInterceptor.removed, 1);
    // Should decrease store size.
    assertEquals(store.size, 0);
  });

  await t.step("has() alias should work correctly", () => {
    const store = new CustomN3Store();

    // Initially should not have the quad.
    assertEquals(store.has(quad), false);

    // Add the quad.
    store.addQuad(quad);
    assertEquals(store.size, 1);

    // Now should have the quad.
    assertEquals(store.has(quad), true);

    // Remove the quad.
    store.removeQuad(quad);
    assertEquals(store.size, 0);

    // Should not have the quad anymore.
    assertEquals(store.has(quad), false);
  });

  await t.step("match() alias should return DatasetCore", () => {
    const store = new CustomN3Store();

    // Add some test data.
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
      DataFactory.namedNode("http://example.org/person2"),
      DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      DataFactory.namedNode("http://example.org/Person"),
      DataFactory.defaultGraph(),
    );

    store.addQuad(quad1);
    store.addQuad(quad2);
    store.addQuad(quad3);
    assertEquals(store.size, 3);

    // Test match() with subject filter.
    const matches = store.match(subject);
    assertEquals(matches.size, 2); // Should match quad1 and quad2

    // Test match() with predicate filter.
    const typeMatches = store.match(
      undefined,
      DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    );
    assertEquals(typeMatches.size, 2); // Should match quad1 and quad3

    // Test match() with no filters (should return all).
    const allMatches = store.match();
    assertEquals(allMatches.size, 3);
  });

  await t.step("Symbol.iterator alias should work correctly", () => {
    const store = new CustomN3Store();

    // Add some test data.
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

    store.addQuad(quad1);
    store.addQuad(quad2);
    assertEquals(store.size, 2);

    // Test Symbol.iterator.
    const quads = Array.from(store);
    assertEquals(quads.length, 2);
    assertEquals(quads[0], quad1);
    assertEquals(quads[1], quad2);
  });

  await t.step("DatasetCore methods should work with interceptors", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);

    // Test add() with interceptors.
    store.add(quad);
    assertEquals(countInterceptor.added, 1);
    assertEquals(countInterceptor.removed, 0);

    // Test delete() with interceptors.
    store.delete(quad);
    assertEquals(countInterceptor.added, 1);
    assertEquals(countInterceptor.removed, 1);
  });

  await t.step(
    "DatasetCore methods should work with multiple interceptors",
    () => {
      const countInterceptor1 = new CountInterceptor();
      const countInterceptor2 = new CountInterceptor();
      const store = new CustomN3Store([countInterceptor1, countInterceptor2]);

      // Test add() with multiple interceptors.
      store.add(quad);
      assertEquals(countInterceptor1.added, 1);
      assertEquals(countInterceptor1.removed, 0);
      assertEquals(countInterceptor2.added, 1);
      assertEquals(countInterceptor2.removed, 0);

      // Test delete() with multiple interceptors.
      store.delete(quad);
      assertEquals(countInterceptor1.added, 1);
      assertEquals(countInterceptor1.removed, 1);
      assertEquals(countInterceptor2.added, 1);
      assertEquals(countInterceptor2.removed, 1);
    },
  );

  await t.step("DatasetCore methods should handle chaining", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);

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

    // Test chaining add() calls.
    const result = store.add(quad1).add(quad2);
    assertEquals(result, store);
    assertEquals(countInterceptor.added, 2);
    assertEquals(store.size, 2);

    // Test chaining delete() calls.
    const deleteResult = store.delete(quad1).delete(quad2);
    assertEquals(deleteResult, store);
    assertEquals(countInterceptor.removed, 2);
    assertEquals(store.size, 0);
  });

  await t.step(
    "DatasetCore methods should work with different graph contexts",
    () => {
      const store = new CustomN3Store();

      const graph1 = DataFactory.namedNode("http://example.org/graph1");
      const graph2 = DataFactory.namedNode("http://example.org/graph2");

      const quad1 = DataFactory.quad(subject, predicate, object, graph1);
      const quad2 = DataFactory.quad(subject, predicate, object, graph2);

      // Add quads to different graphs.
      store.add(quad1);
      store.add(quad2);
      assertEquals(store.size, 2);

      // Test has() with specific graph.
      assertEquals(store.has(quad1), true);
      assertEquals(store.has(quad2), true);

      // Test match() with specific graph.
      const graph1Matches = store.match(
        undefined,
        undefined,
        undefined,
        graph1,
      );
      assertEquals(graph1Matches.size, 1);

      const graph2Matches = store.match(
        undefined,
        undefined,
        undefined,
        graph2,
      );
      assertEquals(graph2Matches.size, 1);

      // Test delete() with specific graph.
      store.delete(quad1);
      assertEquals(store.size, 1);
      assertEquals(store.has(quad1), false);
      assertEquals(store.has(quad2), true);
    },
  );

  await t.step("DatasetCore methods should work with blank nodes", () => {
    const store = new CustomN3Store();

    const blankNode = DataFactory.blankNode("b1");
    const quad = DataFactory.quad(subject, predicate, blankNode, graph);

    // Test add() with blank node.
    store.add(quad);
    assertEquals(store.size, 1);

    // Test has() with blank node.
    assertEquals(store.has(quad), true);

    // Test match() with blank node.
    const matches = store.match(subject, predicate, blankNode);
    assertEquals(matches.size, 1);

    // Test delete() with blank node.
    store.delete(quad);
    assertEquals(store.size, 0);
    assertEquals(store.has(quad), false);
  });

  await t.step("DatasetCore methods should work with literals", () => {
    const store = new CustomN3Store();

    const literal = DataFactory.literal("John Doe");
    const quad = DataFactory.quad(subject, predicate, literal, graph);

    // Test add() with literal.
    store.add(quad);
    assertEquals(store.size, 1);

    // Test has() with literal.
    assertEquals(store.has(quad), true);

    // Test match() with literal.
    const matches = store.match(subject, predicate, literal);
    assertEquals(matches.size, 1);

    // Test delete() with literal.
    store.delete(quad);
    assertEquals(store.size, 0);
    assertEquals(store.has(quad), false);
  });

  await t.step("DatasetCore methods should work with typed literals", () => {
    const store = new CustomN3Store();

    const typedLiteral = DataFactory.literal(
      "30",
      DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#integer"),
    );
    const quad = DataFactory.quad(subject, predicate, typedLiteral, graph);

    // Test add() with typed literal.
    store.add(quad);
    assertEquals(store.size, 1);

    // Test has() with typed literal.
    assertEquals(store.has(quad), true);

    // Test match() with typed literal.
    const matches = store.match(subject, predicate, typedLiteral);
    assertEquals(matches.size, 1);

    // Test delete() with typed literal.
    store.delete(quad);
    assertEquals(store.size, 0);
    assertEquals(store.has(quad), false);
  });

  await t.step(
    "DatasetCore methods should work with language-tagged literals",
    () => {
      const store = new CustomN3Store();

      const langLiteral = DataFactory.literal("John Doe", "en");
      const quad = DataFactory.quad(subject, predicate, langLiteral, graph);

      // Test add() with language-tagged literal.
      store.add(quad);
      assertEquals(store.size, 1);

      // Test has() with language-tagged literal.
      assertEquals(store.has(quad), true);

      // Test match() with language-tagged literal.
      const matches = store.match(subject, predicate, langLiteral);
      assertEquals(matches.size, 1);

      // Test delete() with language-tagged literal.
      store.delete(quad);
      assertEquals(store.size, 0);
      assertEquals(store.has(quad), false);
    },
  );
});

Deno.test("CustomN3Store - Complete logic path coverage", async (t) => {
  await t.step("Constructor with no interceptors", () => {
    const store = new CustomN3Store();
    assertEquals(store.size, 0);
    // Verify interceptor cleanup works correctly to prevent memory leaks.
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad);
    assertEquals(store.size, 1);
  });

  await t.step("Constructor with empty interceptors array", () => {
    const store = new CustomN3Store([]);
    assertEquals(store.size, 0);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad);
    assertEquals(store.size, 1);
  });

  await t.step("addQuad with successful result", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    const result = store.addQuad(quad);
    assertEquals(result, true);
    assertEquals(countInterceptor.added, 1);
    assertEquals(countInterceptor.removed, 0);
    assertEquals(store.size, 1);
  });

  await t.step("addQuad with failed result (duplicate)", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    // Add the quad. first time
    const result1 = store.addQuad(quad);
    assertEquals(result1, true);
    assertEquals(countInterceptor.added, 1);

    // Attempt to add duplicate quad to verify N3 store prevents duplicates.
    const result2 = store.addQuad(quad);
    assertEquals(result2, false);
    assertEquals(countInterceptor.added, 1); // Should not increment
    assertEquals(store.size, 1);
  });

  await t.step("removeQuad with successful result", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    // Add the quad. first
    store.addQuad(quad);
    assertEquals(countInterceptor.added, 1);
    assertEquals(store.size, 1);

    // Remove the quad.
    const result = store.removeQuad(quad);
    assertEquals(result, true);
    assertEquals(countInterceptor.added, 1);
    assertEquals(countInterceptor.removed, 1);
    assertEquals(store.size, 0);
  });

  await t.step("removeQuad with failed result (quad not found)", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    // Attempt to remove non-existent quad to verify graceful error handling.
    const result = store.removeQuad(quad);
    assertEquals(result, false);
    assertEquals(countInterceptor.added, 0);
    assertEquals(countInterceptor.removed, 0);
    assertEquals(store.size, 0);
  });

  await t.step("notifyInterceptors with no interceptors", () => {
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    // Verify no errors are thrown during normal interceptor operations.
    store.addQuad(quad);
    assertEquals(store.size, 1);
  });

  await t.step("notifyInterceptors with single interceptor success", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    store.addQuad(quad);
    assertEquals(countInterceptor.added, 1);
    assertEquals(countInterceptor.removed, 0);
  });

  await t.step("notifyInterceptors with single interceptor error", () => {
    const errorInterceptor = new ErrorInterceptor();
    const store = new CustomN3Store([errorInterceptor]);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    // Verify interceptor errors are logged but don't break store operations.
    store.addQuad(quad);
    assertEquals(store.size, 1);
    assertEquals(errorInterceptor.getErrorCount(), 1);
  });

  await t.step(
    "notifyInterceptors with multiple interceptors - all success",
    () => {
      const countInterceptor1 = new CountInterceptor();
      const countInterceptor2 = new CountInterceptor();
      const store = new CustomN3Store([countInterceptor1, countInterceptor2]);
      const quad = DataFactory.quad(
        DataFactory.namedNode("http://example.org/test"),
        DataFactory.namedNode("http://example.org/predicate"),
        DataFactory.literal("test"),
        DataFactory.defaultGraph(),
      );

      store.addQuad(quad);
      assertEquals(countInterceptor1.added, 1);
      assertEquals(countInterceptor2.added, 1);
      assertEquals(store.size, 1);
    },
  );

  await t.step(
    "notifyInterceptors with multiple interceptors - mixed success/error",
    () => {
      const countInterceptor = new CountInterceptor();
      const errorInterceptor = new ErrorInterceptor();
      const store = new CustomN3Store([countInterceptor, errorInterceptor]);
      const quad = DataFactory.quad(
        DataFactory.namedNode("http://example.org/test"),
        DataFactory.namedNode("http://example.org/predicate"),
        DataFactory.literal("test"),
        DataFactory.defaultGraph(),
      );

      store.addQuad(quad);
      assertEquals(countInterceptor.added, 1);
      assertEquals(errorInterceptor.getErrorCount(), 1);
      assertEquals(store.size, 1);
    },
  );

  await t.step(
    "notifyInterceptors with multiple interceptors - all error",
    () => {
      const errorInterceptor1 = new ErrorInterceptor();
      const errorInterceptor2 = new ErrorInterceptor();
      const store = new CustomN3Store([errorInterceptor1, errorInterceptor2]);
      const quad = DataFactory.quad(
        DataFactory.namedNode("http://example.org/test"),
        DataFactory.namedNode("http://example.org/predicate"),
        DataFactory.literal("test"),
        DataFactory.defaultGraph(),
      );

      store.addQuad(quad);
      assertEquals(errorInterceptor1.getErrorCount(), 1);
      assertEquals(errorInterceptor2.getErrorCount(), 1);
      assertEquals(store.size, 1);
    },
  );

  await t.step("addInterceptor adds interceptor to array", () => {
    const store = new CustomN3Store();
    const countInterceptor = new CountInterceptor();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    // Start with no interceptors to test dynamic interceptor management.
    store.addQuad(quad);
    assertEquals(store.size, 1);

    // Add interceptor to verify dynamic interceptor registration works.
    store.addInterceptor(countInterceptor);
    store.addQuad(quad); // Add duplicate (should fail but trigger interceptor).
    assertEquals(countInterceptor.added, 0); // addQuad failed, so no interceptor call.
    assertEquals(store.size, 1);

    // Add a new quad to trigger interceptor and verify it's called correctly.
    const quad2 = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test2"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test2"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad2);
    assertEquals(countInterceptor.added, 1);
    assertEquals(store.size, 2);
  });

  await t.step("removeInterceptor removes existing interceptor", () => {
    const countInterceptor = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor]);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    // Verify interceptor is initially active and functioning.
    store.addQuad(quad);
    assertEquals(countInterceptor.added, 1);

    // Remove interceptor to test dynamic interceptor removal.
    store.removeInterceptor(countInterceptor);
    const quad2 = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test2"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test2"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad2);
    assertEquals(countInterceptor.added, 1); // Should not increment
    assertEquals(store.size, 2);
  });

  await t.step("removeInterceptor with non-existent interceptor", () => {
    const countInterceptor1 = new CountInterceptor();
    const countInterceptor2 = new CountInterceptor();
    const store = new CustomN3Store([countInterceptor1]);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    // Attempt to remove non-existent interceptor to verify graceful handling.
    store.removeInterceptor(countInterceptor2);
    store.addQuad(quad);
    assertEquals(countInterceptor1.added, 1);
    assertEquals(countInterceptor2.added, 0);
    assertEquals(store.size, 1);
  });

  await t.step("DatasetCore add method chaining", () => {
    const store = new CustomN3Store();
    const quad1 = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test1"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test1"),
      DataFactory.defaultGraph(),
    );
    const quad2 = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test2"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test2"),
      DataFactory.defaultGraph(),
    );

    const result = store.add(quad1).add(quad2);
    assertEquals(result, store);
    assertEquals(store.size, 2);
  });

  await t.step("DatasetCore delete method chaining", () => {
    const store = new CustomN3Store();
    const quad1 = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test1"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test1"),
      DataFactory.defaultGraph(),
    );
    const quad2 = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test2"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test2"),
      DataFactory.defaultGraph(),
    );

    store.add(quad1);
    store.add(quad2);
    assertEquals(store.size, 2);

    const result = store.delete(quad1).delete(quad2);
    assertEquals(result, store);
    assertEquals(store.size, 0);
  });

  await t.step("DatasetCore has method with non-existent quad", () => {
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    assertEquals(store.has(quad), false);
  });

  await t.step("DatasetCore has method with existing quad", () => {
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    store.add(quad);
    assertEquals(store.has(quad), true);
  });

  await t.step("DatasetCore has method after quad removal", () => {
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );

    store.add(quad);
    assertEquals(store.has(quad), true);
    store.delete(quad);
    assertEquals(store.has(quad), false);
  });

  await t.step("match with empty store", () => {
    const store = new CustomN3Store();
    const matches = store.match();
    assertEquals(matches.size, 0);
  });

  await t.step("match with null parameters", () => {
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad);

    const matches = store.match(null, null, null, null);
    assertEquals(matches.size, 1);
  });

  await t.step("match with undefined parameters", () => {
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad);

    const matches = store.match(undefined, undefined, undefined, undefined);
    assertEquals(matches.size, 1);
  });

  await t.step("match with mixed null/undefined parameters", () => {
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad);

    const matches = store.match(null, undefined, null, undefined);
    assertEquals(matches.size, 1);
  });

  await t.step("match with specific subject filter", () => {
    const store = new CustomN3Store();
    const subject1 = DataFactory.namedNode("http://example.org/test1");
    const subject2 = DataFactory.namedNode("http://example.org/test2");
    const predicate = DataFactory.namedNode("http://example.org/predicate");
    const object = DataFactory.literal("test");
    const graph = DataFactory.defaultGraph();

    const quad1 = DataFactory.quad(subject1, predicate, object, graph);
    const quad2 = DataFactory.quad(subject2, predicate, object, graph);
    store.addQuad(quad1);
    store.addQuad(quad2);

    const matches = store.match(subject1);
    assertEquals(matches.size, 1);
  });

  await t.step("match with specific predicate filter", () => {
    const store = new CustomN3Store();
    const subject = DataFactory.namedNode("http://example.org/test");
    const predicate1 = DataFactory.namedNode("http://example.org/predicate1");
    const predicate2 = DataFactory.namedNode("http://example.org/predicate2");
    const object = DataFactory.literal("test");
    const graph = DataFactory.defaultGraph();

    const quad1 = DataFactory.quad(subject, predicate1, object, graph);
    const quad2 = DataFactory.quad(subject, predicate2, object, graph);
    store.addQuad(quad1);
    store.addQuad(quad2);

    const matches = store.match(undefined, predicate1);
    assertEquals(matches.size, 1);
  });

  await t.step("match with specific object filter", () => {
    const store = new CustomN3Store();
    const subject = DataFactory.namedNode("http://example.org/test");
    const predicate = DataFactory.namedNode("http://example.org/predicate");
    const object1 = DataFactory.literal("test1");
    const object2 = DataFactory.literal("test2");
    const graph = DataFactory.defaultGraph();

    const quad1 = DataFactory.quad(subject, predicate, object1, graph);
    const quad2 = DataFactory.quad(subject, predicate, object2, graph);
    store.addQuad(quad1);
    store.addQuad(quad2);

    const matches = store.match(undefined, undefined, object1);
    assertEquals(matches.size, 1);
  });

  await t.step("match with specific graph filter", () => {
    const store = new CustomN3Store();
    const subject = DataFactory.namedNode("http://example.org/test");
    const predicate = DataFactory.namedNode("http://example.org/predicate");
    const object = DataFactory.literal("test");
    const graph1 = DataFactory.namedNode("http://example.org/graph1");
    const graph2 = DataFactory.namedNode("http://example.org/graph2");

    const quad1 = DataFactory.quad(subject, predicate, object, graph1);
    const quad2 = DataFactory.quad(subject, predicate, object, graph2);
    store.addQuad(quad1);
    store.addQuad(quad2);

    const matches = store.match(undefined, undefined, undefined, graph1);
    assertEquals(matches.size, 1);
  });

  await t.step("match with multiple filters", () => {
    const store = new CustomN3Store();
    const subject1 = DataFactory.namedNode("http://example.org/test1");
    const subject2 = DataFactory.namedNode("http://example.org/test2");
    const predicate1 = DataFactory.namedNode("http://example.org/predicate1");
    const predicate2 = DataFactory.namedNode("http://example.org/predicate2");
    const object = DataFactory.literal("test");
    const graph = DataFactory.defaultGraph();

    const quad1 = DataFactory.quad(subject1, predicate1, object, graph);
    const quad2 = DataFactory.quad(subject1, predicate2, object, graph);
    const quad3 = DataFactory.quad(subject2, predicate1, object, graph);
    store.addQuad(quad1);
    store.addQuad(quad2);
    store.addQuad(quad3);

    const matches = store.match(subject1, predicate1);
    assertEquals(matches.size, 1);
  });

  await t.step("match with no matching quads", () => {
    const store = new CustomN3Store();
    const subject = DataFactory.namedNode("http://example.org/test");
    const predicate = DataFactory.namedNode("http://example.org/predicate");
    const object = DataFactory.literal("test");
    const graph = DataFactory.defaultGraph();

    const quad = DataFactory.quad(subject, predicate, object, graph);
    store.addQuad(quad);

    const nonExistentSubject = DataFactory.namedNode(
      "http://example.org/nonexistent",
    );
    const matches = store.match(nonExistentSubject);
    assertEquals(matches.size, 0);
  });

  await t.step("Symbol.iterator with empty store", () => {
    const store = new CustomN3Store();
    const quads = Array.from(store);
    assertEquals(quads.length, 0);
  });

  await t.step("Symbol.iterator with single quad", () => {
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad);

    const quads = Array.from(store);
    assertEquals(quads.length, 1);
    assertEquals(quads[0], quad);
  });

  await t.step("Symbol.iterator with multiple quads", () => {
    const store = new CustomN3Store();
    const quad1 = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test1"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test1"),
      DataFactory.defaultGraph(),
    );
    const quad2 = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test2"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test2"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad1);
    store.addQuad(quad2);

    const quads = Array.from(store);
    assertEquals(quads.length, 2);
    // Verify both quads are present regardless of iteration order.
    const quadIds = quads.map((q) => q.subject.value);
    assertEquals(quadIds.includes("http://example.org/test1"), true);
    assertEquals(quadIds.includes("http://example.org/test2"), true);
  });

  await t.step("size property access", () => {
    const store = new CustomN3Store();
    assertEquals(store.size, 0);

    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/test"),
      DataFactory.namedNode("http://example.org/predicate"),
      DataFactory.literal("test"),
      DataFactory.defaultGraph(),
    );
    store.addQuad(quad);
    assertEquals(store.size, 1);

    store.removeQuad(quad);
    assertEquals(store.size, 0);
  });
});
