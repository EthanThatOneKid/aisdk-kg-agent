import { assert, assertEquals } from "@std/assert";
import {
  parseTurtle,
  validateTurtle,
  type ValidatorRequest,
} from "./validate.ts";
import schemaShapes from "./datashapes.org/schema.ttl" with { type: "text" };

Deno.test("validateTurtle: valid when no schema provided", async () => {
  const req: ValidatorRequest = {
    graphText: `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:a rdf:type ex:Thing .
`.trim(),
  };
  const res = await validateTurtle(req);
  assert(res.isValid);
  assert(res.errorText === null);
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

  const res = await validateTurtle({ graphText: data, schemaText: shapes });
  assert(res.isValid);
  assert(res.errorText === null);
});

Deno.test("validateTurtle: violation produces isValid=false and errorText", async () => {
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

  const res = await validateTurtle({
    graphText: dataMissingName,
    schemaText: shapes,
  });
  assert(!res.isValid);
  assert(typeof res.errorText === "string" && res.errorText.length > 0);
});

Deno.test("validateTurtle: malformed Turtle in graphText returns error", async () => {
  const malformed =
    `@prefix ex: <http://example.org/> .\nex:a ex:b "missing period"`;
  const res = await validateTurtle({
    graphText: malformed,
    schemaText: undefined,
  });
  assert(!res.isValid);
  assert(typeof res.errorText === "string" && res.errorText.length > 0);
});

Deno.test("validateTurtle: malformed Turtle in schemaText returns error", async () => {
  const data = `@prefix ex: <http://example.org/> .\nex:a ex:b ex:c .`;
  const malformedSchema =
    `@prefix sh: <http://www.w3.org/ns/shacl#> .\n[] a sh:NodeShape`;
  const res = await validateTurtle({
    graphText: data,
    schemaText: malformedSchema,
  });
  assert(!res.isValid);
  assert(typeof res.errorText === "string" && res.errorText.length > 0);
});

Deno.test("parseTurtle returns store with quads", () => {
  const store = parseTurtle(
    `@prefix ex: <http://example.org/> .\nex:a ex:b ex:c .`,
  );
  // n3 store exposes size
  // deno-lint-ignore no-explicit-any
  const size = (store as any).size ?? 0;
  assert(size > 0);
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

  const res = await validateTurtle({
    graphText: data,
    schemaText: schemaShapes,
  });
  assert(typeof res.isValid === "boolean");
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

  const res = await validateTurtle({
    graphText: data,
    schemaText: schemaShapes,
  });
  const error = res.errorText ?? "";
  // The underlying validator may serialize reports with varying detail.
  // Require that validation failed and an error message is present.
  assertEquals(res.isValid, false);
  assert(error.length > 0);
});
