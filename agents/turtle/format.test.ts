import { assertEquals } from "@std/assert";
import { substituteVariables, trimFence } from "./format.ts";

Deno.test("substituteVariables: single placeholder replacement", () => {
  const turtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<PLACEHOLDER_ENTITY_1> rdf:type ex:Person .`;

  const variables = new Map([
    ["<PLACEHOLDER_ENTITY_1>", "http://example.org/person1"],
  ]);

  const result = substituteVariables(turtle, variables);

  const expected = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<http://example.org/person1> rdf:type ex:Person .`;

  assertEquals(result, expected);
});

Deno.test("substituteVariables: multiple placeholder replacements", () => {
  const turtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<PLACEHOLDER_ENTITY_1> rdf:type ex:Person ;
           ex:knows <PLACEHOLDER_ENTITY_2> .
<PLACEHOLDER_ENTITY_2> rdf:type ex:Person .`;

  const variables = new Map([
    ["<PLACEHOLDER_ENTITY_1>", "http://example.org/person1"],
    ["<PLACEHOLDER_ENTITY_2>", "http://example.org/person2"],
  ]);

  const result = substituteVariables(turtle, variables);

  const expected = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<http://example.org/person1> rdf:type ex:Person ;
           ex:knows <http://example.org/person2> .
<http://example.org/person2> rdf:type ex:Person .`;

  assertEquals(result, expected);
});

Deno.test("substituteVariables: no placeholders", () => {
  const turtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:person1 rdf:type ex:Person .`;

  const variables = new Map([
    ["<PLACEHOLDER_ENTITY_1>", "http://example.org/person1"],
  ]);

  const result = substituteVariables(turtle, variables);

  assertEquals(result, turtle);
});

Deno.test("substituteVariables: empty variables map throws error", () => {
  const turtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<PLACEHOLDER_ENTITY_1> rdf:type ex:Person .`;

  const variables = new Map();

  try {
    substituteVariables(turtle, variables);
    assertEquals(true, false, "Expected substituteVariables to throw an error");
  } catch (error) {
    assertEquals(error instanceof Error, true);
    assertEquals(
      (error as Error).message,
      "Variable <PLACEHOLDER_ENTITY_1> not found",
    );
  }
});

Deno.test("substituteVariables: missing placeholder throws error", () => {
  const turtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<PLACEHOLDER_ENTITY_1> rdf:type ex:Person ;
           ex:knows <PLACEHOLDER_ENTITY_2> .`;

  const variables = new Map([
    ["<PLACEHOLDER_ENTITY_1>", "http://example.org/person1"],
    // Missing PLACEHOLDER_ENTITY_2
  ]);

  try {
    substituteVariables(turtle, variables);
    assertEquals(true, false, "Expected substituteVariables to throw an error");
  } catch (error) {
    assertEquals(error instanceof Error, true);
    assertEquals(
      (error as Error).message,
      "Variable <PLACEHOLDER_ENTITY_2> not found",
    );
  }
});

Deno.test("substituteVariables: same placeholder used multiple times", () => {
  const turtle = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<PLACEHOLDER_ENTITY_1> rdf:type ex:Person ;
           ex:knows <PLACEHOLDER_ENTITY_1> .`;

  const variables = new Map([
    ["<PLACEHOLDER_ENTITY_1>", "http://example.org/person1"],
  ]);

  const result = substituteVariables(turtle, variables);

  const expected = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<http://example.org/person1> rdf:type ex:Person ;
           ex:knows <http://example.org/person1> .`;

  assertEquals(result, expected);
});

Deno.test("trimFence: single code fence block", () => {
  const text = `Here is some code:

\`\`\`turtle
@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .
\`\`\`

That was the code.`;

  const result = trimFence(text);

  const expected = `Here is some code:

@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .

That was the code.`;

  assertEquals(result, expected);
});

Deno.test("trimFence: multiple code fence blocks", () => {
  const text = `First block:

\`\`\`turtle
@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .
\`\`\`

Second block:

\`\`\`json
{"name": "John", "age": 30}
\`\`\`

End.`;

  const result = trimFence(text);

  const expected = `First block:

@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .

Second block:

{"name": "John", "age": 30}

End.`;

  assertEquals(result, expected);
});

Deno.test("trimFence: code fence without language identifier", () => {
  const text = `Here is some code:

\`\`\`
@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .
\`\`\`

That was the code.`;

  const result = trimFence(text);

  const expected = `Here is some code:

@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .

That was the code.`;

  assertEquals(result, expected);
});

Deno.test("trimFence: no code fences", () => {
  const text = `This is just plain text without any code fences.
It should remain unchanged.`;

  const result = trimFence(text);

  assertEquals(result, text);
});

Deno.test("trimFence: empty string", () => {
  const text = "";

  const result = trimFence(text);

  assertEquals(result, "");
});

Deno.test("trimFence: only code fence", () => {
  const text = `\`\`\`turtle
@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .
\`\`\``;

  const result = trimFence(text);

  const expected = `@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .`;

  assertEquals(result, expected);
});

Deno.test("trimFence: code fence with extra whitespace", () => {
  const text = `\`\`\`turtle
   @prefix ex: <http://example.org/> .
   ex:person1 rdf:type ex:Person .
\`\`\``;

  const result = trimFence(text);

  const expected = `@prefix ex: <http://example.org/> .
   ex:person1 rdf:type ex:Person .`;

  assertEquals(result, expected);
});

Deno.test("trimFence: malformed fence (missing closing)", () => {
  const text = `\`\`\`turtle
@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .`;

  const result = trimFence(text);

  // Should only remove the opening fence
  const expected = `@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .`;

  assertEquals(result, expected);
});

Deno.test("trimFence: malformed fence (missing opening)", () => {
  const text = `@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .
\`\`\``;

  const result = trimFence(text);

  // Should only remove the closing fence
  const expected = `@prefix ex: <http://example.org/> .
ex:person1 rdf:type ex:Person .`;

  assertEquals(result, expected);
});
