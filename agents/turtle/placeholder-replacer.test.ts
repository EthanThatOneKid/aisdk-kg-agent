import { assert, assertEquals } from "@std/assert";
import {
  extractPlaceholderIds,
  replacePlaceholderIds,
} from "./placeholder-replacer.ts";

Deno.test("extractPlaceholderIds: finds placeholder IDs", () => {
  const turtle = `
@prefix schema: <https://schema.org/> .

<PLACEHOLDER_ENTITY_1> a schema:Person ;
    schema:name "John" .

<PLACEHOLDER_ENTITY_2> a schema:Store ;
    schema:name "The Store" .
  `;

  const placeholders = extractPlaceholderIds(turtle);
  assertEquals(placeholders, ["PLACEHOLDER_ENTITY_1", "PLACEHOLDER_ENTITY_2"]);
});

Deno.test("extractPlaceholderIds: handles duplicates", () => {
  const turtle = `
<PLACEHOLDER_ENTITY_1> a schema:Person .
<PLACEHOLDER_ENTITY_1> schema:name "John" .
<PLACEHOLDER_ENTITY_2> a schema:Store .
  `;

  const placeholders = extractPlaceholderIds(turtle);
  assertEquals(placeholders, ["PLACEHOLDER_ENTITY_1", "PLACEHOLDER_ENTITY_2"]);
});

Deno.test("extractPlaceholderIds: returns empty array when no placeholders", () => {
  const turtle = `
@prefix schema: <https://schema.org/> .

<https://example.org/person1> a schema:Person .
  `;

  const placeholders = extractPlaceholderIds(turtle);
  assertEquals(placeholders, []);
});

Deno.test("extractPlaceholderIds: detects placeholders", () => {
  const turtle = `
<PLACEHOLDER_ENTITY_1> a schema:Person .
  `;

  const placeholders = extractPlaceholderIds(turtle);
  assert(placeholders.length > 0);
});

Deno.test("extractPlaceholderIds: returns empty array when no placeholders", () => {
  const turtle = `
<https://example.org/person1> a schema:Person .
  `;

  const placeholders = extractPlaceholderIds(turtle);
  assertEquals(placeholders.length, 0);
});

Deno.test("replacePlaceholderIds: replaces placeholders with provided mapping", () => {
  const turtle = `
@prefix schema: <https://schema.org/> .

<PLACEHOLDER_ENTITY_1> a schema:Person ;
    schema:name "John" .

<PLACEHOLDER_ENTITY_2> a schema:Store ;
    schema:name "The Store" .
  `;

  const mapping = new Map([
    ["PLACEHOLDER_ENTITY_1", "https://example.org/person1"],
    ["PLACEHOLDER_ENTITY_2", "https://example.org/store1"],
  ]);

  const result = replacePlaceholderIds(turtle, mapping);

  // Should not contain any placeholders
  assert(extractPlaceholderIds(result).length === 0);

  // Should contain the provided IDs
  assert(result.includes("https://example.org/person1"));
  assert(result.includes("https://example.org/store1"));

  // Should preserve the structure
  assert(result.includes("schema:Person"));
  assert(result.includes("schema:Store"));
  assert(result.includes('schema:name "John"'));
  assert(result.includes('schema:name "The Store"'));
});

Deno.test("replacePlaceholderIds: handles duplicate placeholders", () => {
  const turtle = `
<PLACEHOLDER_ENTITY_1> a schema:Person .
<PLACEHOLDER_ENTITY_1> schema:name "John" .
  `;

  const mapping = new Map([
    ["PLACEHOLDER_ENTITY_1", "https://example.org/person1"],
  ]);

  const result = replacePlaceholderIds(turtle, mapping);

  // Should not contain any placeholders
  assert(extractPlaceholderIds(result).length === 0);

  // Should have the same ID used for both occurrences
  const idMatches = result.match(/https:\/\/example\.org\/person1/g);
  assert(idMatches);
  assertEquals(idMatches.length, 2);
});

Deno.test("replacePlaceholderIds: returns original content when no placeholders", () => {
  const turtle = `
@prefix schema: <https://schema.org/> .

<https://example.org/person1> a schema:Person .
  `;

  const mapping = new Map();
  const result = replacePlaceholderIds(turtle, mapping);
  assertEquals(result, turtle);
});
