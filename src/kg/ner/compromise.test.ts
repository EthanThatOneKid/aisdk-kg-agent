import { assert, assertEquals } from "@std/assert";
import { CompromiseService } from "./compromise.ts";

const service = new CompromiseService();

Deno.test("CompromiseService - recognize", async () => {
  const text = "Alice went to Central Park on March 15, 2024 to meet Bob.";
  const entities = await service.recognize(text);

  // CompromiseService extracts entities from multiple categories, resulting in duplicates.
  assertEquals(entities.length, 8);

  // Check that we get the expected entities (with duplicates across categories).
  const entityTexts = entities.map((e) => e.text);
  assert(entityTexts.includes("Alice"));
  assert(entityTexts.includes("Central Park"));
  assert(entityTexts.includes("on March 15, 2024"));
  assert(entityTexts.includes("March 15,"));
  assert(entityTexts.includes("Bob."));

  // Check that entities are sorted by offset.
  for (let i = 1; i < entities.length; i++) {
    assert(
      entities[i].offset.start >= entities[i - 1].offset.start,
    );
  }
});
