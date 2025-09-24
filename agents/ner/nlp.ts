import { default as nlp } from "compromise";
import { default as pluginDates } from "compromise-dates";
import type { NerEntity } from "./schema.ts";

nlp.extend(pluginDates);

interface CompromiseOffset {
  index: number;
  start: number;
  length: number;
}

interface CompromiseEntity {
  text: string;
  offset: CompromiseOffset;
}

export function recognizeEntities(text: string): NerEntity[] {
  const entities: NerEntity[] = [];
  const seenEntities = new Set<string>();

  const doc = nlp(text);

  // Extract all entity types.
  const topics = doc.topics().json({
    offset: true,
    unique: true,
  }) as CompromiseEntity[];
  const nouns = doc.nouns().json({
    offset: true,
    unique: true,
  }) as CompromiseEntity[];
  // deno-lint-ignore no-explicit-any
  const dates = (doc as any).dates().json({
    offset: true,
    unique: true,
  }) as CompromiseEntity[];

  // Helper function to add entity with deduplication.
  function addEntity(text: string, type: string, offset: CompromiseOffset) {
    const normalizedText = text.trim().toLowerCase();
    const key = `${normalizedText}:${offset.start}:${offset.length}`;

    if (!seenEntities.has(key)) {
      seenEntities.add(key);
      entities.push({
        text: text.trim(),
        type,
        offset,
      });
    }
  }

  // Add entities with deduplication.
  topics.forEach((topic: CompromiseEntity) =>
    addEntity(topic.text, "topic", topic.offset)
  );
  nouns.forEach((noun: CompromiseEntity) =>
    addEntity(noun.text, "noun", noun.offset)
  );
  dates.forEach((date: CompromiseEntity) =>
    addEntity(date.text, "date", date.offset)
  );

  return entities.toSorted((a, b) => a.offset.start - b.offset.start);
}
