import { assert, assertEquals } from "@std/assert";
import { recognizeEntities } from "./nlp.ts";
import { nerEntitySchema } from "./schema.ts";

Deno.test("recognizeEntities: extracts topics, nouns, and dates", () => {
  const text = "Alice went to Central Park on March 15, 2024 to meet Bob.";
  const entities = recognizeEntities(text);

  // Should have multiple entities
  assert(entities.length > 0);

  // Check that entities are sorted by offset
  for (let i = 1; i < entities.length; i++) {
    assert(entities[i].offset.start >= entities[i - 1].offset.start);
  }

  // Should contain expected entities
  const entityTexts = entities.map((e) => e.text);
  assert(entityTexts.some((text) => text.includes("Alice")));
  assert(entityTexts.some((text) => text.includes("Central Park")));
  assert(entityTexts.some((text) => text.includes("Bob")));

  // Should have proper structure validated by Zod
  for (const entity of entities) {
    const validation = nerEntitySchema.safeParse(entity);
    assert(
      validation.success,
      `Entity validation failed: ${validation.error?.message}`,
    );
    assert(entity.offset.length > 0);
  }
});

Deno.test("recognizeEntities: handles empty text", () => {
  const entities = recognizeEntities("");
  assertEquals(entities.length, 0);
});

Deno.test("recognizeEntities: handles text with no entities", () => {
  const entities = recognizeEntities("the and or but");
  // Should still return some entities (common words might be recognized as topics/nouns)
  assert(Array.isArray(entities));

  // Validate all entities with Zod
  for (const entity of entities) {
    const validation = nerEntitySchema.safeParse(entity);
    assert(
      validation.success,
      `Entity validation failed: ${validation.error?.message}`,
    );
  }
});

Deno.test("recognizeEntities: extracts dates correctly", () => {
  const text = "The meeting is scheduled for December 25, 2024 at 3:00 PM.";
  const entities = recognizeEntities(text);

  const dateEntities = entities.filter((e) => e.type === "date");
  assert(dateEntities.length > 0);

  // Should find the date
  const dateTexts = dateEntities.map((e) => e.text);
  assert(
    dateTexts.some((text) =>
      text.includes("December") || text.includes("2024")
    ),
  );

  // Validate all entities with Zod
  for (const entity of entities) {
    const validation = nerEntitySchema.safeParse(entity);
    assert(
      validation.success,
      `Entity validation failed: ${validation.error?.message}`,
    );
  }
});

Deno.test("recognizeEntities: handles complex text with multiple entity types", () => {
  const text =
    "Dr. Smith from Microsoft visited the University of California on January 1, 2025 to discuss AI research with Professor Johnson.";
  const entities = recognizeEntities(text);

  // Should extract various entity types
  const types = new Set(entities.map((e) => e.type));
  assert(types.size > 0);

  // Should find proper nouns and topics
  const entityTexts = entities.map((e) => e.text);
  assert(
    entityTexts.some((text) =>
      text.includes("Smith") || text.includes("Microsoft")
    ),
  );
  assert(
    entityTexts.some((text) =>
      text.includes("University") || text.includes("California")
    ),
  );
  assert(entityTexts.some((text) => text.includes("Johnson")));

  // Validate all entities with Zod
  for (const entity of entities) {
    const validation = nerEntitySchema.safeParse(entity);
    assert(
      validation.success,
      `Entity validation failed: ${validation.error?.message}`,
    );
  }
});

Deno.test("recognizeEntities: deduplicates repeated entities", () => {
  const text = "Alice met Alice at the park. Alice was happy.";
  const entities = recognizeEntities(text);

  // Should find Alice entities
  const aliceEntities = entities.filter((e) =>
    e.text.toLowerCase().includes("alice")
  );
  assert(aliceEntities.length > 0);

  // Check for duplicates by counting unique text+position combinations
  const entityKeys = new Set();
  let duplicateCount = 0;

  for (const entity of entities) {
    const key =
      `${entity.text.toLowerCase()}:${entity.offset.start}:${entity.offset.length}`;
    if (entityKeys.has(key)) {
      duplicateCount++;
    } else {
      entityKeys.add(key);
    }
  }

  // Should have no exact duplicates (same text at same position)
  assertEquals(
    duplicateCount,
    0,
    "Found duplicate entities with same text and position",
  );
});

Deno.test("recognizeEntities: handles case variations correctly", () => {
  const text = "Alice met alice at ALICE's house.";
  const entities = recognizeEntities(text);

  // Should find Alice entities
  const aliceEntities = entities.filter((e) =>
    e.text.toLowerCase().includes("alice")
  );
  assert(aliceEntities.length > 0);

  // Check that we don't have multiple entities for the same normalized text at same position
  const normalizedPositions = new Map();
  let caseDuplicateCount = 0;

  for (const entity of entities) {
    const normalized = entity.text.toLowerCase();
    const key = `${normalized}:${entity.offset.start}:${entity.offset.length}`;

    if (normalizedPositions.has(key)) {
      caseDuplicateCount++;
    } else {
      normalizedPositions.set(key, entity);
    }
  }

  // Should not have case-sensitive duplicates at same position
  assertEquals(
    caseDuplicateCount,
    0,
    "Found case-sensitive duplicates at same position",
  );
});

Deno.test("recognizeEntities: prevents cross-type duplicates", () => {
  const text = "Central Park is beautiful. I love Central Park.";
  const entities = recognizeEntities(text);

  // Should find Central Park entities
  const parkEntities = entities.filter((e) =>
    e.text.toLowerCase().includes("central park")
  );
  assert(parkEntities.length > 0);

  // Check that same text doesn't appear as both topic and noun at same position
  const positionTypes = new Map();
  let crossTypeDuplicates = 0;

  for (const entity of entities) {
    const key =
      `${entity.text.toLowerCase()}:${entity.offset.start}:${entity.offset.length}`;

    if (positionTypes.has(key)) {
      const existingType = positionTypes.get(key);
      if (existingType !== entity.type) {
        crossTypeDuplicates++;
      }
    } else {
      positionTypes.set(key, entity.type);
    }
  }

  // Should not have same entity as different types at same position
  assertEquals(
    crossTypeDuplicates,
    0,
    "Found cross-type duplicates at same position",
  );
});

Deno.test("recognizeEntities: preserves entities at different positions", () => {
  const text =
    "John visited Paris. Later, John went to London. John was tired.";
  const entities = recognizeEntities(text);

  // Should find multiple John entities at different positions
  const johnEntities = entities.filter((e) =>
    e.text.toLowerCase().includes("john")
  );
  assert(johnEntities.length > 0);

  // Should have different positions for repeated entities
  const johnPositions = johnEntities.map((e) => e.offset.start);
  const uniquePositions = new Set(johnPositions);

  // If we have multiple Johns, they should be at different positions
  if (johnEntities.length > 1) {
    assert(
      uniquePositions.size > 1,
      "Multiple John entities should be at different positions",
    );
  }
});

Deno.test("recognizeEntities: handles mixed entity types with deduplication", () => {
  const text =
    "Dr. Smith visited Paris on January 1, 2024. Smith loves Paris. January 1, 2024 was cold.";
  const entities = recognizeEntities(text);

  // Should find various entity types
  const types = new Set(entities.map((e) => e.type));
  assert(types.size > 0);

  // Check for any duplicates
  const entityKeys = new Set();
  let totalDuplicates = 0;

  for (const entity of entities) {
    const key =
      `${entity.text.toLowerCase()}:${entity.offset.start}:${entity.offset.length}`;
    if (entityKeys.has(key)) {
      totalDuplicates++;
    } else {
      entityKeys.add(key);
    }
  }

  // Should have no duplicates
  assertEquals(totalDuplicates, 0, "Found duplicates in mixed entity types");

  // Validate all entities with Zod
  for (const entity of entities) {
    const validation = nerEntitySchema.safeParse(entity);
    assert(
      validation.success,
      `Entity validation failed: ${validation.error?.message}`,
    );
  }
});
