import { default as nlp } from "compromise";

// TypeScript interfaces for compromise data structures.
interface CompromiseTerm {
  text: string;
  tags: string[];
  offset?: {
    index: number;
    start: number;
    length: number;
  };
}

interface CompromiseNoun {
  text: string;
  terms: CompromiseTerm[];
  noun?: {
    isPlural: boolean;
    determiner?: string;
    root?: string;
  };
}

interface CompromisePronoun {
  text: string;
  terms: CompromiseTerm[];
}

interface CompromiseVerb {
  text: string;
  terms: CompromiseTerm[];
  verb?: {
    grammar?: {
      tense?: string;
      form?: string;
    };
    infinitive?: string;
  };
}

interface CompromisePreposition {
  text: string;
  terms: CompromiseTerm[];
}

interface CompromiseTopic {
  text: string;
  terms: CompromiseTerm[];
}

interface CompromiseClause {
  nouns: () => {
    json: (options: { offset: boolean; unique: boolean }) => CompromiseNoun[];
  };
  pronouns: () => {
    json: (
      options: { offset: boolean; unique: boolean },
    ) => CompromisePronoun[];
  };
  verbs: () => {
    json: (options: { offset: boolean; unique: boolean }) => CompromiseVerb[];
  };
  prepositions: () => {
    json: (
      options: { offset: boolean; unique: boolean },
    ) => CompromisePreposition[];
  };
  topics: () => {
    json: (options: { offset: boolean; unique: boolean }) => CompromiseTopic[];
  };
}

interface CompromiseDocument {
  clauses: () => CompromiseClause[];
}

// Entity and relationship interfaces.
interface Entity {
  id: string;
  text: string;
  type: string;
  category: string;
  properties: Record<string, unknown>;
  confidence: number;
  source: string;
  range: {
    start: number;
    end: number;
  };
}

interface Relationship {
  id: string;
  type: string;
  subject: string;
  subjectText: string;
  predicate: string;
  object: string;
  objectText: string;
  properties: {
    tense: string;
    form: string;
    infinitive: string;
  };
  confidence: number;
}

interface Location {
  id: string;
  text: string;
  type: string;
  properties: {
    category: string;
    determiner: string;
    root: string;
    confidence: number;
  };
  confidence: number;
}

interface TemporalContext {
  text: string;
  type: string;
  properties: {
    root: string;
  };
}

interface ClauseReport {
  summary: {
    totalEntities: number;
    totalRelationships: number;
    totalLocations: number;
  };
  entities: Entity[];
  relationships: Relationship[];
  locations: Location[];
  analysis: {
    mainAction: string | null;
    temporalContext: TemporalContext[];
    spatialContext: Location[];
  };
}

/**
 * Analyze text with Compromise and return structured entity relationship reports.
 */
export function analyze(text: string): ClauseReport[] {
  // Handle edge cases.
  if (!text || text.trim().length === 0) {
    return [];
  }

  const terms: ClauseReport[] = [];
  const doc = nlp(text) as CompromiseDocument;
  const clauses = doc.clauses();

  // Handle case where no clauses are found.
  if (clauses.length === 0) {
    return [];
  }

  clauses.forEach((clause) => {
    try {
      terms.push(analyzeClause(clause));
    } catch (error) {
      console.warn("Error analyzing clause:", error);
      // Return empty report for problematic clauses.
      terms.push({
        summary: { totalEntities: 0, totalRelationships: 0, totalLocations: 0 },
        entities: [],
        relationships: [],
        locations: [],
        analysis: { mainAction: null, temporalContext: [], spatialContext: [] },
      });
    }
  });

  return terms;
}

/**
 * Analyze a clause and return a structured report.
 */
function analyzeClause(clause: CompromiseClause): ClauseReport {
  const nouns = clause.nouns().json({ offset: true, unique: true });
  const pronouns = clause.pronouns().json({ offset: true, unique: true });
  const verbs = clause.verbs().json({ offset: true, unique: true });
  const prepositions = clause.prepositions().json({
    offset: true,
    unique: true,
  });
  const topics = clause.topics().json({ offset: true, unique: true });

  // Generate structured report.
  const report = generateEntityRelationshipReport({
    nouns,
    pronouns,
    verbs,
    prepositions,
    topics,
  });

  return report;
}

/**
 * Generate a structured report of entities and their relationships.
 */
function generateEntityRelationshipReport(data: {
  nouns: CompromiseNoun[];
  pronouns: CompromisePronoun[];
  verbs: CompromiseVerb[];
  prepositions: CompromisePreposition[];
  topics: CompromiseTopic[];
}): ClauseReport {
  const { nouns, pronouns, verbs, prepositions, topics } = data;

  // Extract entities.
  const entities = extractEntities(nouns, pronouns, topics);

  // Extract relationships.
  const relationships = extractRelationships(verbs, prepositions, entities);

  // Extract locations.
  const locations = extractLocations(nouns, prepositions);

  return {
    summary: {
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      totalLocations: locations.length,
    },
    entities: entities,
    relationships: relationships,
    locations: locations,
    analysis: {
      mainAction: verbs.length > 0 ? verbs[0].text : null,
      temporalContext: extractTemporalContext(nouns),
      spatialContext: locations,
    },
  };
}

// Entity type definitions and detection rules.
interface EntityTypeConfig {
  type: string;
  category: string;
  tags: string[];
  keywords?: string[];
  confidence: number;
  properties?: (
    entity: CompromiseNoun | CompromisePronoun | CompromiseTopic,
  ) => Record<string, unknown>;
  filter?: (
    entity: CompromiseNoun | CompromisePronoun | CompromiseTopic,
  ) => boolean;
  transform?: (text: string) => string;
}

const ENTITY_TYPE_CONFIGS: EntityTypeConfig[] = [
  {
    type: "PERSON",
    category: "pronoun",
    tags: ["Pronoun"],
    confidence: 1.0,
    properties: (entity) => ({
      person: entity.terms[0]?.tags.includes("Pronoun")
        ? "first_person"
        : "unknown",
      number: "singular",
    }),
  },
  {
    type: "PERSON",
    category: "noun",
    tags: ["Person", "FirstName", "MaleName", "FemaleName"],
    keywords: ["dr", "professor", "prof", "mr", "mrs", "ms", "miss"],
    confidence: 0.9,
    properties: (entity) => ({
      isPlural: "noun" in entity ? entity.noun?.isPlural ?? false : false,
      determiner: "noun" in entity ? entity.noun?.determiner ?? "" : "",
      root: "noun" in entity ? entity.noun?.root ?? entity.text : entity.text,
      originalText: entity.text,
    }),
    transform: (text) => {
      // Handle possessives by extracting the person name.
      if (text.includes("'s")) {
        const possessiveMatch = text.match(/^(.+?)'s/);
        if (possessiveMatch) return possessiveMatch[1];
      }
      // Handle titles and clean up text.
      return text.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+/i, "")
        .trim();
    },
  },
  {
    type: "ORGANIZATION",
    category: "noun",
    tags: ["Organization", "ProperNoun"],
    keywords: [
      "inc",
      "corp",
      "llc",
      "ltd",
      "company",
      "university",
      "school",
      "hospital",
      "museum",
      "library",
    ],
    confidence: 0.9,
    properties: (entity) => ({
      isPlural: "noun" in entity ? entity.noun?.isPlural ?? false : false,
      determiner: "noun" in entity ? entity.noun?.determiner ?? "" : "",
      root: "noun" in entity ? entity.noun?.root ?? entity.text : entity.text,
      originalText: entity.text,
    }),
  },
  {
    type: "LOCATION",
    category: "noun",
    tags: ["Place", "Location"],
    keywords: [
      "city",
      "town",
      "state",
      "country",
      "street",
      "avenue",
      "boulevard",
      "park",
      "mountain",
      "river",
      "lake",
    ],
    confidence: 0.9,
    properties: (entity) => ({
      isPlural: "noun" in entity ? entity.noun?.isPlural ?? false : false,
      determiner: "noun" in entity ? entity.noun?.determiner ?? "" : "",
      root: "noun" in entity ? entity.noun?.root ?? entity.text : entity.text,
      originalText: entity.text,
    }),
  },
  {
    type: "ESTABLISHMENT",
    category: "noun",
    tags: ["Organization", "ProperNoun"],
    keywords: [
      "cafe",
      "restaurant",
      "hotel",
      "airport",
      "station",
      "plaza",
      "center",
      "centre",
      "mall",
      "store",
      "shop",
    ],
    confidence: 0.8,
    properties: (entity) => ({
      isPlural: "noun" in entity ? entity.noun?.isPlural ?? false : false,
      determiner: "noun" in entity ? entity.noun?.determiner ?? "" : "",
      root: "noun" in entity ? entity.noun?.root ?? entity.text : entity.text,
      originalText: entity.text,
    }),
  },
  {
    type: "EVENT",
    category: "noun",
    tags: ["ProperNoun"],
    keywords: [
      "conference",
      "meeting",
      "wedding",
      "party",
      "festival",
      "concert",
      "game",
      "match",
    ],
    confidence: 0.8,
    properties: (entity) => ({
      isPlural: "noun" in entity ? entity.noun?.isPlural ?? false : false,
      determiner: "noun" in entity ? entity.noun?.determiner ?? "" : "",
      root: "noun" in entity ? entity.noun?.root ?? entity.text : entity.text,
      originalText: entity.text,
    }),
  },
  {
    type: "PRODUCT",
    category: "noun",
    tags: ["ProperNoun"],
    keywords: [
      "phone",
      "computer",
      "car",
      "book",
      "movie",
      "song",
      "app",
      "software",
    ],
    confidence: 0.7,
    properties: (entity) => ({
      isPlural: "noun" in entity ? entity.noun?.isPlural ?? false : false,
      determiner: "noun" in entity ? entity.noun?.determiner ?? "" : "",
      root: "noun" in entity ? entity.noun?.root ?? entity.text : entity.text,
      originalText: entity.text,
    }),
  },
];

// Generic entity detection rules.
const GENERIC_FILTERS = [
  {
    name: "date_only",
    filter: (entity: CompromiseNoun | CompromisePronoun | CompromiseTopic) => {
      const terms = entity.terms ?? [];
      const isDate = terms.some((term) => term.tags.includes("Date"));
      const hasOtherTags = terms.some((term) =>
        !term.tags.includes("Date") &&
        (term.tags.includes("Person") || term.tags.includes("Organization") ||
          term.tags.includes("Place"))
      );
      return isDate && !hasOtherTags;
    },
  },
  {
    name: "generic_words",
    filter: (entity: CompromiseNoun | CompromisePronoun | CompromiseTopic) => {
      const genericWords = [
        "weather",
        "lunch",
        "time",
        "day",
        "way",
        "thing",
        "stuff",
      ];
      const hasGenericWord = genericWords.some((word) =>
        entity.text.toLowerCase().includes(word)
      );
      const hasMeaningfulTags = entity.terms?.some((term) =>
        term.tags.includes("Person") ||
        term.tags.includes("Organization") ||
        term.tags.includes("Place")
      );
      return hasGenericWord && !hasMeaningfulTags;
    },
  },
];

/**
 * Calculate the text range for an entity based on its offset information.
 */
function calculateEntityRange(
  entity: CompromiseNoun | CompromisePronoun | CompromiseTopic,
): { start: number; end: number } {
  // Get the first term with offset information.
  const firstTerm = entity.terms.find((term) => term.offset !== undefined);

  if (firstTerm && firstTerm.offset) {
    // Access the start property of the offset object.
    const start = firstTerm.offset.start;
    const end = start + entity.text.length;
    return { start, end };
  }

  // Fallback: if no offset information is available, return 0-based range.
  return { start: 0, end: entity.text.length };
}

/**
 * Generic entity extraction function.
 */
function extractEntities(
  nouns: CompromiseNoun[],
  pronouns: CompromisePronoun[],
  topics: CompromiseTopic[],
): Entity[] {
  const entities: Entity[] = [];
  const processedTexts = new Set<string>();

  // Combine all input sources.
  const allSources = [
    ...pronouns.map((p) => ({ ...p, source: "pronoun" })),
    ...nouns.map((n) => ({ ...n, source: "noun" })),
    ...topics.map((t) => ({ ...t, source: "topic" })),
  ];

  allSources.forEach((entity) => {
    // Skip if already processed.
    if (processedTexts.has(entity.text)) {
      return;
    }

    // Apply generic filters.
    const shouldSkip = GENERIC_FILTERS.some((filter) => filter.filter(entity));
    if (shouldSkip) {
      return;
    }

    // Find matching entity type configuration.
    const config = findMatchingEntityType(entity);
    if (!config) {
      return;
    }

    // Transform text if needed.
    let entityText = entity.text;
    if (config.transform) {
      entityText = config.transform(entity.text);
    }

    // Check for similar entities to avoid duplicates with different text but same root.
    const existingEntity = entities.find((e) =>
      e.type === config.type &&
      (e.text === entityText || e.properties?.root === entityText ||
        entityText.includes(e.text))
    );

    if (existingEntity) {
      // Update confidence if this match is better.
      if (config.confidence > existingEntity.confidence) {
        existingEntity.confidence = config.confidence;
        existingEntity.text = entityText;
        existingEntity.properties = config.properties
          ? config.properties(entity)
          : {};
        existingEntity.range = calculateEntityRange(entity);
      }
      processedTexts.add(entity.text);
      return;
    }

    // Calculate text range from offset information.
    const range = calculateEntityRange(entity);

    // Create entity.
    const newEntity = {
      id: `entity_${entities.length + 1}`,
      text: entityText,
      type: config.type,
      category: config.category,
      properties: config.properties ? config.properties(entity) : {},
      confidence: config.confidence,
      source: entity.source,
      range: range,
    };

    entities.push(newEntity);
    processedTexts.add(entity.text);
  });

  return entities;
}

/**
 * Find the best matching entity type configuration.
 */
function findMatchingEntityType(
  entity: CompromiseNoun | CompromisePronoun | CompromiseTopic,
): EntityTypeConfig | null {
  const terms = entity.terms ?? [];
  const text = entity.text.toLowerCase();

  // Score each configuration.
  const scoredConfigs = ENTITY_TYPE_CONFIGS.map((config) => {
    let score = 0;

    // Check tag matches with highest priority.
    const tagMatches = terms.some((term) =>
      config.tags.some((tag) => term.tags.includes(tag))
    );
    if (tagMatches) score += 20;

    // Check keyword matches.
    if (config.keywords) {
      const keywordMatches = config.keywords.some((keyword) =>
        text.includes(keyword.toLowerCase())
      );
      if (keywordMatches) score += 10;

      // Bonus for exact keyword matches.
      const exactKeywordMatches = config.keywords.filter((keyword) =>
        text === keyword.toLowerCase()
      ).length;
      score += exactKeywordMatches * 5;
    }

    // Bonus for proper nouns which are more likely to be entities.
    const isProperNoun = terms.some((term) => term.tags.includes("ProperNoun"));
    if (isProperNoun) score += 5;

    // Bonus for mixed language support by detecting non-English characters.
    const hasNonEnglishChars = /[^\x20-\x7E]/.test(entity.text);
    if (hasNonEnglishChars && config.type === "PERSON") score += 3;

    // Apply custom filter if it exists.
    if (config.filter && !config.filter(entity)) {
      score = 0;
    }

    return { config, score };
  });

  // Find the highest scoring configuration.
  const bestMatch = scoredConfigs
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return bestMatch?.config ?? null;
}

/**
 * Extract relationships between entities.
 */
function extractRelationships(
  verbs: CompromiseVerb[],
  _prepositions: CompromisePreposition[],
  entities: Entity[],
): Relationship[] {
  const relationships: Relationship[] = [];

  verbs.forEach((verb) => {
    // Find subject entities which are pronouns or people.
    const subjects = entities.filter((e) =>
      (e.category === "pronoun") ||
      (e.category === "noun" && e.type === "PERSON")
    );

    // Find object entities which are people, organizations, or locations.
    const objects = entities.filter((e) =>
      e.category === "noun" &&
      (e.type === "PERSON" || e.type === "ORGANIZATION" ||
        e.type === "LOCATION")
    );

    // Create relationships between subjects and objects.
    subjects.forEach((subject) => {
      objects.forEach((object) => {
        // Don't create self-relationships.
        if (subject.id !== object.id) {
          let relationshipType = "INTERACTION";
          if (
            verb.text.includes("met") || verb.text.includes("went") ||
            verb.text.includes("visited") ||
            verb.text.includes("saw") || verb.text.includes("talked") ||
            verb.text.includes("spoke")
          ) {
            relationshipType = "SOCIAL_INTERACTION";
          } else if (
            verb.text.includes("had") || verb.text.includes("ate") ||
            verb.text.includes("drank") ||
            verb.text.includes("bought") || verb.text.includes("sold") ||
            verb.text.includes("worked")
          ) {
            relationshipType = "ACTIVITY";
          } else if (
            verb.text.includes("lives") || verb.text.includes("works") ||
            verb.text.includes("studies")
          ) {
            relationshipType = "OCCUPATION";
          } else if (
            verb.text.includes("loves") || verb.text.includes("likes") ||
            verb.text.includes("hates")
          ) {
            relationshipType = "EMOTIONAL";
          } else if (
            verb.text.includes("knows") || verb.text.includes("remembers") ||
            verb.text.includes("forgets")
          ) {
            relationshipType = "COGNITIVE";
          }

          relationships.push({
            id: `rel_${relationships.length + 1}`,
            type: relationshipType,
            subject: subject.id,
            subjectText: subject.text,
            predicate: verb.text,
            object: object.id,
            objectText: object.text,
            properties: {
              tense: verb.verb?.grammar?.tense || "unknown",
              form: verb.verb?.grammar?.form || "unknown",
              infinitive: verb.verb?.infinitive || verb.text,
            },
            confidence: 0.9,
          });
        }
      });
    });
  });

  return relationships;
}

// Location type definitions.
interface LocationTypeConfig {
  type: string;
  category: string;
  keywords: string[];
  confidence: number;
  properties?: (entity: CompromiseNoun) => Record<string, unknown>;
}

const LOCATION_TYPE_CONFIGS: LocationTypeConfig[] = [
  {
    type: "ESTABLISHMENT",
    category: "cafe",
    keywords: ["cafe", "coffee", "coffeeshop", "café"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "restaurant",
    keywords: ["restaurant", "diner", "bistro", "eatery", "food"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "museum",
    keywords: ["museum", "gallery", "exhibition", "art"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "park",
    keywords: ["park", "garden", "plaza", "square"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "landmark",
    keywords: ["tower", "bridge", "monument", "statue", "building"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "institution",
    keywords: ["library", "archive", "institute"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "educational",
    keywords: ["school", "university", "college", "academy", "institute"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "medical",
    keywords: ["hospital", "clinic", "medical", "health"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "hospitality",
    keywords: ["hotel", "motel", "inn", "resort"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "transportation",
    keywords: ["airport", "station", "terminal", "depot"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "street",
    keywords: ["street", "avenue", "boulevard", "road", "lane", "drive"],
    confidence: 0.8,
  },
  {
    type: "ESTABLISHMENT",
    category: "public_space",
    keywords: ["center", "centre", "plaza", "square", "mall"],
    confidence: 0.8,
  },
  {
    type: "LOCATION",
    category: "city",
    keywords: ["city", "town", "village", "municipality"],
    confidence: 0.9,
  },
  {
    type: "LOCATION",
    category: "country",
    keywords: ["country", "nation", "state", "republic"],
    confidence: 0.9,
  },
  {
    type: "LOCATION",
    category: "geographic",
    keywords: ["mountain", "river", "lake", "ocean", "sea", "island"],
    confidence: 0.9,
  },
];

/**
 * Extract location information using generalized config system.
 */
function extractLocations(
  nouns: CompromiseNoun[],
  _prepositions: CompromisePreposition[],
): Location[] {
  const locations: Location[] = [];

  // Find all potential location entities.
  const allSources = [
    ...nouns.map((n) => ({ ...n, source: "noun" })),
  ];

  allSources.forEach((entity) => {
    const terms = entity.terms ?? [];

    // Check if it has location-related tags.
    const hasLocationTags = terms.some((term) =>
      term.tags.includes("Place") ||
      term.tags.includes("Location") ||
      term.tags.includes("Organization")
    );

    if (!hasLocationTags) return;

    // Find best matching location type.
    const bestMatch = findBestLocationType(entity);
    if (!bestMatch) return;

    locations.push({
      id: `location_${locations.length + 1}`,
      text: entity.text,
      type: bestMatch.type,
      properties: {
        category: bestMatch.category,
        determiner: entity.noun?.determiner ?? "",
        root: entity.noun?.root ?? entity.text,
        confidence: bestMatch.confidence,
      },
      confidence: bestMatch.confidence,
    });
  });

  return locations;
}

/**
 * Find the best matching location type configuration.
 */
function findBestLocationType(
  entity: CompromiseNoun,
): LocationTypeConfig | null {
  const text = entity.text.toLowerCase();
  const terms = entity.terms ?? [];

  // Score each configuration.
  const scoredConfigs = LOCATION_TYPE_CONFIGS.map((config) => {
    let score = 0;

    // Check keyword matches.
    const keywordMatches = config.keywords.some((keyword) =>
      text.includes(keyword.toLowerCase())
    );
    if (keywordMatches) score += 15;

    // Bonus for exact matches.
    const exactMatches = config.keywords.filter((keyword) =>
      text === keyword.toLowerCase()
    ).length;
    score += exactMatches * 10;

    // Bonus for multiple keyword matches.
    const multipleMatches = config.keywords.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    ).length;
    if (multipleMatches > 1) score += multipleMatches * 3;

    // Check for location-specific tags.
    const hasLocationTags = terms.some((term) =>
      term.tags.includes("Place") || term.tags.includes("Location")
    );
    if (hasLocationTags) score += 5;

    // Check for organization tags for establishments.
    const hasOrgTags = terms.some((term) => term.tags.includes("Organization"));
    if (hasOrgTags && config.type === "ESTABLISHMENT") score += 5;

    // Bonus for proper nouns which are more likely to be named locations.
    const isProperNoun = terms.some((term) => term.tags.includes("ProperNoun"));
    if (isProperNoun) score += 3;

    // Bonus for mixed language support.
    const hasNonEnglishChars = /[^\x20-\x7E]/.test(entity.text);
    if (hasNonEnglishChars) score += 2;

    return { config, score };
  });

  // Find the highest scoring configuration.
  const bestMatch = scoredConfigs
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return bestMatch?.config ?? null;
}

/**
 * Extract temporal context.
 */
function extractTemporalContext(nouns: CompromiseNoun[]): TemporalContext[] {
  const temporalNouns = nouns.filter((noun) =>
    noun.terms?.some((term) => term.tags.includes("Date"))
  );

  return temporalNouns.map((noun) => ({
    text: noun.text,
    type: "TEMPORAL",
    properties: {
      root: noun.noun?.root ?? noun.text,
    },
  }));
}
