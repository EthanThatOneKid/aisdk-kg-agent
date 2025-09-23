import { assertEquals } from "@std/assert";
import { QueryEngine } from "@comunica/query-sparql";
import { DataFactory } from "n3";
import { CustomN3Store } from "./custom-n3store.ts";
import { CountInterceptor } from "./interceptor/count-interceptor.ts";
import { ErrorInterceptor } from "./interceptor/error-interceptor.ts";

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

      // First add the quad, then remove it
      store.addQuad(quad1);
      assertEquals(countInterceptor.added, 1);
      assertEquals(countInterceptor.removed, 0);

      // Now remove it
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

  // Add a quad - should succeed despite error interceptor
  const addResult = store.addQuad(quad);
  assertEquals(addResult, true);
  assertEquals(countInterceptor.added, 1);
  assertEquals(countInterceptor.removed, 0);

  // Verify error was captured by test interceptor
  assertEquals(errorInterceptor.getErrorCount(), 1);
  const addErrors = errorInterceptor.getErrorsForMethod("addQuad");
  assertEquals(addErrors.length, 1);
  assertEquals(
    addErrors[0].error.message,
    "ErrorInterceptor: addQuad failed",
  );

  // Remove the quad - should succeed despite error interceptor
  const removeResult = store.removeQuad(quad);
  assertEquals(removeResult, true);
  assertEquals(countInterceptor.added, 1);
  assertEquals(countInterceptor.removed, 1);

  // Verify error was captured for removeQuad too
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

  // Add a quad - should succeed despite multiple error interceptors
  const addResult = store.addQuad(quad);
  assertEquals(addResult, true);
  assertEquals(countInterceptor.added, 1);
  assertEquals(countInterceptor.removed, 0);

  // Verify both error interceptors captured errors
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

Deno.test("Interceptor error handling with SPARQL operations", async () => {
  const countInterceptor = new CountInterceptor();
  const errorInterceptor = new ErrorInterceptor();
  const store = new CustomN3Store([countInterceptor, errorInterceptor]);

  // SPARQL INSERT should succeed despite error interceptor
  await queryEngine.queryVoid(
    `PREFIX ex: <http://example.org/>
     PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
     
     INSERT DATA {
       ex:person1 rdf:type ex:Person ;
                  ex:name "John Doe" .
     }`,
    { sources: [store] },
  );

  // Verify data was added despite errors
  assertEquals(store.size, 2);
  assertEquals(countInterceptor.added, 2);
  assertEquals(countInterceptor.removed, 0);

  // Verify errors were captured for each quad
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
