import { default as nlp } from "compromise";
import { default as pluginDates } from "compromise-dates";
import type { NerEntity } from "./schema.ts";

nlp.extend(pluginDates);

export function recognizeEntities(text: string): NerEntity[] {
  const entities: NerEntity[] = [];

  const doc = nlp(text);

  const topics = doc.topics().json({ offset: true, unique: true });
  for (const topic of topics) {
    entities.push({
      text: topic.text.trim(),
      type: "topic",
      offset: topic.offset,
    });
  }

  const nouns = doc.nouns().json({ offset: true, unique: true });
  for (const noun of nouns) {
    entities.push({
      text: noun.text.trim(),
      type: "noun",
      offset: noun.offset,
    });
  }

  // deno-lint-ignore no-explicit-any
  const dates = (doc as any).dates().json({ offset: true, unique: true });
  for (const date of dates) {
    entities.push({
      text: date.text.trim(),
      type: "date",
      offset: date.offset,
    });
  }

  return entities.toSorted((a, b) => a.offset.start - b.offset.start);
}
