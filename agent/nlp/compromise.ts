import { default as nlp } from "compromise";
import { default as pluginDates } from "compromise-dates";

nlp.extend(pluginDates);

export interface NlpAnalysis {
  entities: NlpEntity[];
  dates: NlpDate[];
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

export interface NlpDate {
  text: string;
  start: string;
  end: string;
  timezone: string;
  duration: NlpDateDuration;
  offset: NlpOffset;
}

export interface NlpDateDuration {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
}

export interface NlpOffset {
  index: number;
  start: number;
  length: number;
}

export function analyzeContent(content: string) {
  const analyses: NlpAnalysis[] = [];

  const doc = nlp(content);
  doc.clauses().forEach((clause) => {
    analyses.push(analyzeClause(clause));
  });

  return analyses;
}

// deno-lint-ignore no-explicit-any
function analyzeClause(clause: any): NlpAnalysis {
  return {
    entities: analyzeEntities(clause),
    dates: analyzeDates(clause),
  };
}

// deno-lint-ignore no-explicit-any
function analyzeEntities(clause: any): NlpEntity[] {
  const entities: NlpEntity[] = [];
  const processedOffsets = new Set<string>();

  // Process topics first
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

  // Process nouns - skip only if exact same offset as existing entity
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

// deno-lint-ignore no-explicit-any
export function analyzeDates(clause: any): NlpDate[] {
  return clause.dates()
    .json({ offset: true, unique: true })
    // deno-lint-ignore no-explicit-any
    .map((date: any): NlpDate => ({
      text: date.text,
      start: date.dates.start,
      end: date.dates.end,
      timezone: date.dates.timezone,
      duration: date.dates.duration,
      offset: date.offset,
    }));
}

function collectTags(terms: Array<{ tags: string[] }>): string[] {
  try {
    const tags = new Set<string>();
    for (const term of terms) {
      for (const tag of term.tags) {
        tags.add(tag);
      }
    }

    return Array.from(tags);
  } catch (error) {
    console.log({ terms });
    throw error;
  }
}
