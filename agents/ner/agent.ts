import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { SearchService } from "#/search/search.ts";

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

export interface ClassifiedEntity {
  text: string;
  label: NerLabel;
  confidence?: number;
}

export interface NerResult {
  originalText: string;
  classifiedEntities: Record<NerLabel, string[]>;
  enrichedText: string;
  knowledgeBaseLinks: Map<string, string>;
}

export class NerAgent {
  private readonly model = google("models/gemini-2.5-flash");

  constructor(private readonly searchService: SearchService) {}

  /**
   * Processes input text using AI to classify entities and enrich with knowledge base links.
   * Follows the notebook pattern with structured output and knowledge enrichment.
   */
  async processText(inputText: string): Promise<NerResult> {
    // Step 1: AI-powered entity classification
    const classifiedEntities = await this.classifyEntities(inputText);

    // Step 2: Knowledge base enrichment
    const knowledgeBaseLinks = await this.enrichWithKnowledgeBase(
      classifiedEntities,
    );

    // Step 3: Generate enriched text with links
    const enrichedText = this.generateEnrichedText(
      inputText,
      knowledgeBaseLinks,
    );

    return {
      originalText: inputText,
      classifiedEntities,
      enrichedText,
      knowledgeBaseLinks,
    };
  }

  /**
   * Uses AI to classify entities in text using structured output.
   * Based on the notebook's system message and example approach.
   */
  protected async classifyEntities(
    text: string,
  ): Promise<Record<NerLabel, string[]>> {
    const schema = z.object(
      NER_LABELS.reduce((acc, label) => {
        acc[label] = z.array(z.string()).optional();
        return acc;
      }, {} as Record<NerLabel, z.ZodOptional<z.ZodArray<z.ZodString>>>),
    );

    const { object } = await generateObject({
      model: this.model,
      schema,
      prompt: this.buildClassificationPrompt(text),
      temperature: 0,
    });

    // Ensure all labels are present as arrays
    const result: Record<NerLabel, string[]> = {} as Record<NerLabel, string[]>;
    for (const label of NER_LABELS) {
      result[label] = object[label] ?? [];
    }

    return result;
  }

  /**
   * Builds the classification prompt following the notebook pattern.
   */
  private buildClassificationPrompt(text: string): string {
    return `You are an expert in Natural Language Processing. Your task is to identify common Named Entities (NER) in a given text.
The possible common Named Entities (NER) types are exclusively: (${
      NER_LABELS.join(", ")
    }).

EXAMPLE:
    Text: 'In Germany, in 1440, goldsmith Johannes Gutenberg invented the movable-type printing press. His work led to an information revolution and the unprecedented mass-spread of literature throughout Europe. Modelled on the design of the existing screw presses, a single Renaissance movable-type printing press could produce up to 3,600 pages per workday.'
    {
        "gpe": ["Germany", "Europe"],
        "date": ["1440"],
        "person": ["Johannes Gutenberg"],
        "product": ["movable-type printing press"],
        "event": ["Renaissance"],
        "quantity": ["3,600 pages"],
        "time": ["workday"]
    }

TASK:
    Text: ${text}`;
  }

  /**
   * Enriches entities with knowledge base links.
   * Based on the notebook's find_all_links function.
   */
  private async enrichWithKnowledgeBase(
    classifiedEntities: Record<NerLabel, string[]>,
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

    for (const [label, entities] of Object.entries(classifiedEntities)) {
      if (whitelist.includes(label as NerLabel)) {
        for (const entity of entities) {
          try {
            const results = await this.searchService.search(entity);
            if (results.length > 0) {
              // Use the first result as the knowledge base link
              entityLinkMap.set(entity, results[0]);
            }
          } catch (error) {
            console.warn(
              `Failed to find knowledge base link for entity "${entity}":`,
              error,
            );
          }
        }
      }
    }

    return entityLinkMap;
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
   * Logs the processing results in a readable format.
   */
  logResults(result: NerResult): void {
    console.log("=== AI-Powered Named Entity Recognition Results ===");
    console.log(`Original Text: "${result.originalText}"`);
    console.log(`Enriched Text: "${result.enrichedText}"`);

    console.log("\nClassified Entities:");
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
