import { assert, assertEquals } from "@std/assert";
import {
  extractPlaceholderIds,
  hasPlaceholderIds,
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

Deno.test("hasPlaceholderIds: detects placeholders", () => {
  const turtle = `
<PLACEHOLDER_ENTITY_1> a schema:Person .
  `;

  assert(hasPlaceholderIds(turtle));
});

Deno.test("hasPlaceholderIds: returns false when no placeholders", () => {
  const turtle = `
<https://example.org/person1> a schema:Person .
  `;

  assert(!hasPlaceholderIds(turtle));
});

Deno.test("replacePlaceholderIds: replaces placeholders with generated IDs", async () => {
  const turtle = `
@prefix schema: <https://schema.org/> .

<PLACEHOLDER_ENTITY_1> a schema:Person ;
    schema:name "John" .

<PLACEHOLDER_ENTITY_2> a schema:Store ;
    schema:name "The Store" .
  `;

  const result = await replacePlaceholderIds(turtle);

  // Should not contain any placeholders
  assert(!hasPlaceholderIds(result));

  // Should contain generated IDs (UUIDs)
  assert(result.includes("https://fartlabs.org/.well-known/genid/"));

  // Should preserve the structure
  assert(result.includes("schema:Person"));
  assert(result.includes("schema:Store"));
  assert(result.includes('schema:name "John"'));
  assert(result.includes('schema:name "The Store"'));
});

Deno.test("replacePlaceholderIds: handles duplicate placeholders", async () => {
  const turtle = `
<PLACEHOLDER_ENTITY_1> a schema:Person .
<PLACEHOLDER_ENTITY_1> schema:name "John" .
  `;

  const result = await replacePlaceholderIds(turtle);

  // Should not contain any placeholders
  assert(!hasPlaceholderIds(result));

  // Should have the same ID used for both occurrences
  const idMatches = result.match(
    /https:\/\/fartlabs\.org\/\.well-known\/genid\/[a-f0-9-]+/g,
  );
  assert(idMatches);
  assertEquals(idMatches.length, 2);
  assertEquals(idMatches[0], idMatches[1]); // Same ID used twice
});

Deno.test("replacePlaceholderIds: returns original content when no placeholders", async () => {
  const turtle = `
@prefix schema: <https://schema.org/> .

<https://example.org/person1> a schema:Person .
  `;

  const result = await replacePlaceholderIds(turtle);
  assertEquals(result, turtle);
});
