import { default as nlp } from "compromise";

// TODO: Extend nlp with pluginDates.

export interface NlpClause {
  text: string;
  entities: NlpEntity[];
}

export interface NlpEntity {
  text: string;
  tags: string[];
  noun?: NlpNoun;
  offset: NlpOffset;
}

export interface NlpNoun {
  root: string;
  determiner: string;
  adjectives: string[];
  isPlural: boolean;
  isSubordinate: boolean;
}

export interface NlpOffset {
  index: number;
  start: number;
  length: number;
}

export function recognizeEntityGroups(content: string) {
  const entityGroups: NlpClause[] = [];

  const doc = nlp(content);
  doc.clauses().forEach((clause) => {
    const entities = recognizeEntities(clause);
    entityGroups.push({ text: clause.text(), entities });
  });

  return entityGroups;
}

// deno-lint-ignore no-explicit-any
function recognizeEntities(clause: any): NlpEntity[] {
  const entities: NlpEntity[] = [];
  const processedOffsets = new Set<string>();

  // Process topics first.
  const topics = clause.topics().json({ offset: true, unique: true });
  for (const topic of topics) {
    const offsetKey = `${topic.offset.start}-${
      topic.offset.start + topic.offset.length
    }`;
    if (!processedOffsets.has(offsetKey)) {
      entities.push({
        text: topic.text.trim(),
        tags: collectTags(topic.terms),
        offset: topic.offset,
      });
      processedOffsets.add(offsetKey);
    }
  }

  // Process nouns and skip only if exact same offset as existing entity.
  const nouns = clause.nouns().json({ offset: true, unique: true });
  for (const noun of nouns) {
    const offsetKey = `${noun.offset.start}-${
      noun.offset.start + noun.offset.length
    }`;
    if (!processedOffsets.has(offsetKey)) {
      entities.push({
        text: noun.text.trim(),
        tags: collectTags(noun.terms),
        offset: noun.offset,
        noun: {
          root: noun.noun.root,
          determiner: noun.noun.determiner,
          adjectives: noun.noun.adjectives,
          isPlural: noun.noun.isPlural,
          isSubordinate: noun.noun.isSubordinate,
        },
      });

      processedOffsets.add(offsetKey);
    }
  }

  return entities.toSorted((a, b) => a.offset.start - b.offset.start);
}

function collectTags(terms: Array<{ tags: string[] }>): string[] {
  const tags = new Set<string>();
  for (const term of terms) {
    for (const tag of term.tags) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}
