import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { SearchService } from "#/search/search.ts";
import { type NlpClause, recognizeEntityGroups } from "#/nlp/compromise.ts";

// NER labels based on the notebook
export const NER_LABELS = [
  "person", // people, including fictional characters
  "fac", // buildings, airports, highways, bridges
  "org", // organizations, companies, agencies, institutions
  "gpe", // geopolitical entities like countries, cities, states
  "loc", // non-gpe locations
  "product", // vehicles, foods, apparel, appliances, software, toys
  "event", // named sports, scientific milestones, historical events
  "work_of_art", // titles of books, songs, movies
  "law", // named laws, acts, or legislations
  "language", // any named language
  "date", // absolute or relative dates or periods
  "time", // time units smaller than a day
  "percent", // percentage (e.g., "twenty percent", "18%")
  "money", // monetary values, including unit
  "quantity", // measurements, e.g., weight or distance
] as const;

export type NerLabel = typeof NER_LABELS[number];

export interface HybridEntity {
  text: string;
  label: NerLabel;
  confidence?: number;
  nlpData?: {
    tags: string[];
    offset: { start: number; length: number };
    noun?: {
      root: string;
      determiner: string;
      adjectives: string[];
      isPlural: boolean;
      isSubordinate: boolean;
    };
  };
}

export interface HybridNerResult {
  originalText: string;
  clauses: NlpClause[];
  entities: HybridEntity[];
  classifiedEntities: Record<NerLabel, string[]>;
  enrichedText: string;
  knowledgeBaseLinks: Map<string, string>;
}

export class HybridNerAgent {
  private readonly model = google("models/gemini-2.5-flash");

  constructor(private readonly searchService: SearchService) {}

  /**
   * Processes input text using both Compromise NLP and AI classification.
   * Combines linguistic analysis with LLM intelligence for comprehensive NER.
   */
  async processText(inputText: string): Promise<HybridNerResult> {
    // Step 1: Compromise NLP analysis for robust entity extraction
    const clauses = recognizeEntityGroups(inputText);
    const extractedEntities = this.extractEntitiesFromClauses(clauses);

    // Step 2: AI classification of extracted entities
    const classifiedEntities = await this.classifyEntitiesWithContext(
      inputText,
      extractedEntities,
    );

    // Step 3: Knowledge base enrichment
    const knowledgeBaseLinks = await this.enrichWithKnowledgeBase(
      classifiedEntities,
    );

    // Step 4: Generate enriched text with links
    const enrichedText = this.generateEnrichedText(
      inputText,
      knowledgeBaseLinks,
    );

    return {
      originalText: inputText,
      clauses,
      entities: classifiedEntities,
      classifiedEntities: this.groupEntitiesByLabel(classifiedEntities),
      enrichedText,
      knowledgeBaseLinks,
    };
  }

  /**
   * Extracts entities from Compromise NLP clauses with linguistic metadata.
   */
  private extractEntitiesFromClauses(clauses: NlpClause[]): HybridEntity[] {
    const entities: HybridEntity[] = [];

    for (const clause of clauses) {
      for (const entity of clause.entities) {
        entities.push({
          text: entity.text,
          label: "person", // Default label, will be classified by AI
          nlpData: {
            tags: entity.tags,
            offset: entity.offset,
            noun: entity.noun,
          },
        });
      }
    }

    return entities;
  }

  /**
   * Uses AI to classify entities with context from both text and NLP data.
   * Provides the LLM with linguistic information to make better decisions.
   */
  protected async classifyEntitiesWithContext(
    originalText: string,
    entities: HybridEntity[],
  ): Promise<HybridEntity[]> {
    if (entities.length === 0) {
      return [];
    }

    const schema = z.object({
      classifications: z.array(
        z.object({
          text: z.string(),
          label: z.enum(NER_LABELS),
          confidence: z.number().min(0).max(1).optional(),
        }),
      ),
    });

    const entityTexts = entities.map((e) => e.text);
    const nlpContext = entities
      .map((e) => {
        const nounInfo = e.nlpData?.noun
          ? ` (noun: ${e.nlpData.noun.root}, plural: ${e.nlpData.noun.isPlural})`
          : "";
        const tagsInfo = e.nlpData?.tags
          ? ` (tags: ${e.nlpData.tags.join(", ")})`
          : "";
        return `${e.text}${nounInfo}${tagsInfo}`;
      })
      .join(", ");

    const prompt =
      `You are an expert in Natural Language Processing. Classify the following entities extracted from text using linguistic analysis.

CONTEXT:
Original text: "${originalText}"
Extracted entities with linguistic data: ${nlpContext}

The possible Named Entity types are: ${NER_LABELS.join(", ")}.

EXAMPLE:
Text: "In Germany, in 1440, goldsmith Johannes Gutenberg invented the movable-type printing press."
Entities: "Germany (tags: PlaceName), 1440 (tags: Date), Johannes Gutenberg (noun: Gutenberg, plural: false), movable-type printing press (noun: press, plural: false)"
Classifications: [
  {"text": "Germany", "label": "gpe", "confidence": 0.95},
  {"text": "1440", "label": "date", "confidence": 0.98},
  {"text": "Johannes Gutenberg", "label": "person", "confidence": 0.92},
  {"text": "movable-type printing press", "label": "product", "confidence": 0.88}
]

TASK: Classify these entities: ${entityTexts.join(", ")}`;

    const { object } = await generateObject({
      model: this.model,
      schema,
      prompt,
      temperature: 0,
    });

    // Merge AI classifications with original entity data
    return entities.map((entity) => {
      const classification = object.classifications.find(
        (c) => c.text === entity.text,
      );
      return {
        ...entity,
        label: classification?.label ?? "person",
        confidence: classification?.confidence,
      };
    });
  }

  /**
   * Enriches entities with knowledge base links.
   * Based on the notebook's find_all_links function.
   */
  private async enrichWithKnowledgeBase(
    entities: HybridEntity[],
  ): Promise<Map<string, string>> {
    const whitelist: NerLabel[] = [
      "event",
      "gpe",
      "org",
      "person",
      "product",
      "work_of_art",
    ];
    const entityLinkMap = new Map<string, string>();

    for (const entity of entities) {
      if (whitelist.includes(entity.label)) {
        try {
          const results = await this.searchService.search(entity.text);
          if (results.length > 0) {
            entityLinkMap.set(entity.text, results[0]);
          }
        } catch (error) {
          console.warn(
            `Failed to find knowledge base link for entity "${entity.text}":`,
            error,
          );
        }
      }
    }

    return entityLinkMap;
  }

  /**
   * Groups entities by their labels for easy access.
   */
  private groupEntitiesByLabel(
    entities: HybridEntity[],
  ): Record<NerLabel, string[]> {
    const grouped: Record<NerLabel, string[]> = {} as Record<
      NerLabel,
      string[]
    >;

    for (const label of NER_LABELS) {
      grouped[label] = [];
    }

    for (const entity of entities) {
      grouped[entity.label].push(entity.text);
    }

    return grouped;
  }

  /**
   * Generates enriched text with knowledge base links.
   * Based on the notebook's enrich_entities function.
   */
  private generateEnrichedText(
    originalText: string,
    knowledgeBaseLinks: Map<string, string>,
  ): string {
    let enrichedText = originalText;

    for (const [entity, link] of knowledgeBaseLinks) {
      enrichedText = enrichedText.replace(entity, `[${entity}](${link})`);
    }

    return enrichedText;
  }

  /**
   * Logs the processing results in a comprehensive format.
   */
  logResults(result: HybridNerResult): void {
    console.log("=== Hybrid NER Results (Compromise + AI) ===");
    console.log(`Original Text: "${result.originalText}"`);
    console.log(`Enriched Text: "${result.enrichedText}"`);

    console.log("\nLinguistic Analysis:");
    for (const clause of result.clauses) {
      console.log(`  Clause: "${clause.text}"`);
      for (const entity of clause.entities) {
        const hybridEntity = result.entities.find((e) =>
          e.text === entity.text
        );
        const tags = entity.tags.join(", ");
        const label = hybridEntity?.label ?? "unknown";
        const confidence = hybridEntity?.confidence
          ? ` (${Math.round(hybridEntity.confidence * 100)}%)`
          : "";
        console.log(
          `    "${entity.text}" -> ${label}${confidence} [${tags}]`,
        );
      }
    }

    console.log("\nClassified Entities by Type:");
    for (const [label, entities] of Object.entries(result.classifiedEntities)) {
      if (entities.length > 0) {
        console.log(`  ${label}: [${entities.join(", ")}]`);
      }
    }

    console.log("\nKnowledge Base Links:");
    for (const [entity, link] of result.knowledgeBaseLinks) {
      console.log(`  ${entity} -> ${link}`);
    }
  }
}
