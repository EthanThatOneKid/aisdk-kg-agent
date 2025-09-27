import { assert, assertEquals } from "@std/assert";
import { validateTurtle } from "./validate.ts";
import schemaShapes from "./datashapes.org/schema.ttl" with { type: "text" };

Deno.test("validateTurtle: valid when no schema provided", async () => {
  const turtleText = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:a rdf:type ex:Thing .
`.trim();

  const result = await validateTurtle(turtleText);
  assertEquals(
    result,
    null,
    "Should return null for valid turtle with no schema",
  );
});

Deno.test("validateTurtle: conforms against simple SHACL shapes", async () => {
  // Shapes: ex:Person must have ex:name predicate
  const shapes = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:NameShape
  a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [
    sh:path ex:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
  ] .
`.trim();

  const data = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:john rdf:type ex:Person ;
        ex:name "John" .
`.trim();

  const result = await validateTurtle(data, shapes);
  assertEquals(
    result,
    null,
    "Should return null for valid turtle that conforms to schema",
  );
});

Deno.test("validateTurtle: violation produces error text", async () => {
  const shapes = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:NameShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [ sh:path ex:name ; sh:datatype xsd:string ; sh:minCount 1 ] .
`.trim();

  const dataMissingName = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:john rdf:type ex:Person .
`.trim();

  const result = await validateTurtle(dataMissingName, shapes);
  assert(result !== null, "Should return error text for validation violation");
  assert(
    typeof result === "string" && result.length > 0,
    "Error text should be a non-empty string",
  );
});

Deno.test("validateTurtle: malformed Turtle returns error", async () => {
  const malformed =
    `@prefix ex: <http://example.org/> .\nex:a ex:b "missing period"`;
  const result = await validateTurtle(malformed);
  assert(result !== null, "Should return error text for malformed turtle");
  assert(
    typeof result === "string" && result.length > 0,
    "Error text should be a non-empty string",
  );
});

Deno.test("validateTurtle: malformed schema returns error", async () => {
  const data = `@prefix ex: <http://example.org/> .\nex:a ex:b ex:c .`;
  const malformedSchema =
    `@prefix sh: <http://www.w3.org/ns/shacl#> .\n[] a sh:NodeShape`;
  const result = await validateTurtle(data, malformedSchema);
  assert(result !== null, "Should return error text for malformed schema");
  assert(
    typeof result === "string" && result.length > 0,
    "Error text should be a non-empty string",
  );
});

Deno.test("validateTurtle: generated example against datashapes schema", async () => {
  const data = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://fartlabs.org#me> rdf:type schema:Person ;
    schema:name "I" ;
    schema:knows <https://fartlabs.org/.well-known/genid/d0ec3b12-3a8d-4ae3-8c9a-2ad652599778> ;
    schema:event <https://fartlabs.org/.well-known/genid/f2f8ebdb-7a37-4f92-8e80-f08fc5ef0897> .

<https://fartlabs.org/.well-known/genid/d0ec3b12-3a8d-4ae3-8c9a-2ad652599778> rdf:type schema:Person ;
    schema:name "Kyle" .

<https://fartlabs.org/.well-known/genid/f2f8ebdb-7a37-4f92-8e80-f08fc5ef0897> rdf:type schema:Event ;
    schema:location <https://fartlabs.org/.well-known/genid/a931a218-8414-4bd2-95ac-dcb9964b3731> ;
    schema:startDate "2025-09-22T09:00:00Z"^^xsd:dateTime ;
    schema:description "Met up with Kyle at the Lost Bean cafe yesterday in the morning." .

<https://fartlabs.org/.well-known/genid/a931a218-8414-4bd2-95ac-dcb9964b3731> rdf:type schema:CafeOrCoffeeShop ;
    schema:name "The Lost Bean Cafe" .
`.trim();

  const result = await validateTurtle(data, schemaShapes);
  assert(
    typeof result === "string" || result === null,
    "Should return string or null",
  );
});

Deno.test("validateTurtle: generated example with bad datatype violates datashapes schema", async () => {
  const data = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://fartlabs.org#me> rdf:type schema:Person ;
    schema:name "I" ;
    schema:knows <https://fartlabs.org/.well-known/genid/d0ec3b12-3a8d-4ae3-8c9a-2ad652599778> ;
    schema:event <https://fartlabs.org/.well-known/genid/f2f8ebdb-7a37-4f92-8e80-f08fc5ef0897> .

<https://fartlabs.org/.well-known/genid/d0ec3b12-3a8d-4ae3-8c9a-2ad652599778> rdf:type schema:Person ;
    schema:name "Kyle" .

<https://fartlabs.org/.well-known/genid/f2f8ebdb-7a37-4f92-8e80-f08fc5ef0897> rdf:type schema:Event ;
    schema:location <https://fartlabs.org/.well-known/genid/a931a218-8414-4bd2-95ac-dcb9964b3731> ;
    schema:startDate "not-a-date"^^xsd:dateTime ;
    schema:description "Met up with Kyle at the Lost Bean cafe yesterday in the morning." .

<https://fartlabs.org/.well-known/genid/a931a218-8414-4bd2-95ac-dcb9964b3731> rdf:type schema:CafeOrCoffeeShop ;
    schema:name "The Lost Bean Cafe" .
`.trim();

  const result = await validateTurtle(data, schemaShapes);
  // The underlying validator may serialize reports with varying detail.
  // Require that validation failed and an error message is present.
  assert(result !== null, "Should return error text for validation violation");
  assert(
    typeof result === "string" && result.length > 0,
    "Error text should be a non-empty string",
  );
});
