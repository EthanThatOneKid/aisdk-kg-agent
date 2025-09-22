import { assert, assertEquals } from "@std/assert";
import { isValidTurtle } from "#/turtle/validate.ts";

Deno.test("isValidTurtle: accepts minimal valid triple", () => {
  const turtle = [
    "@prefix ex: <http://example.org/> .",
    "",
    "ex:a ex:b ex:c .",
  ].join("\n");
  const result = isValidTurtle(turtle);
  assert(result.ok);
});

Deno.test("isValidTurtle: accepts with prefixes and literals", () => {
  const turtle = [
    "@prefix ex: <http://example.org/> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    "",
    'ex:Meeting1 ex:date "2025-09-22"^^xsd:date .',
  ].join("\n");
  const result = isValidTurtle(turtle);
  assert(result.ok);
});

Deno.test("isValidTurtle: rejects missing period", () => {
  const turtle = "ex:a ex:b ex:c"; // missing final period
  const result = isValidTurtle(turtle);
  assertEquals(result.ok, false);
});

Deno.test("isValidTurtle: rejects code fences", () => {
  const turtle = "```turtle\nex:a ex:b ex:c .\n```";
  const result = isValidTurtle(turtle);
  assertEquals(result.ok, false);
});
