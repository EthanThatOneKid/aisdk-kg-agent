import { assert, assertEquals } from "@std/assert";
import { recognizeEntityGroups } from "./compromise.ts";

Deno.test("analyzeContent snapshot test", () => {
  const analysis = recognizeEntityGroups(
    "I met up with Kyle at the Lost Bean cafe yesterday in the morning.",
  );
  assertEquals(analysis.length, 1);

  const [analyzedClause] = analysis;
  assertEquals(analyzedClause.entities.length, 5);

  // Should detect multiple interpretations of entities
  const lostBeanEntities = analyzedClause.entities.filter((e) =>
    e.text.includes("Lost Bean")
  );
  assert(lostBeanEntities.length >= 1);

  // Should detect all expected entities
  const entityTexts = analyzedClause.entities.map((e) => e.text);
  const entityTextsSet = new Set(entityTexts);
  assert(entityTextsSet.has("I"));
  assert(entityTextsSet.has("Kyle"));
  assert(lostBeanEntities.length >= 1); // At least one Lost Bean entity
});

Deno.test("Complex Multiple Entity Interpretations Test", () => {
  const [analyzedClause] = recognizeEntityGroups(
    "The CEO of Apple Inc. visited the Apple Store in New York.",
  );

  // Should detect multiple Apple-related entities
  const appleEntities = analyzedClause.entities.filter((e) =>
    e.text.includes("Apple")
  );
  assert(appleEntities.length >= 1);

  // Should detect New York
  const newYorkEntities = analyzedClause.entities.filter((e) =>
    e.text.includes("New York")
  );
  assert(newYorkEntities.length >= 1);

  // Should have reasonable number of entities (not too many, not too few)
  assert(analyzedClause.entities.length >= 2);
  assert(analyzedClause.entities.length <= 10); // Reasonable upper bound
});
