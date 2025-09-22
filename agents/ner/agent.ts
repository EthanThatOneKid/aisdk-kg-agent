import type { SearchService } from "#/search/search.ts";
import { type NlpClause, recognizeEntityGroups } from "#/nlp/compromise.ts";

export interface NerResult {
  clauses: NlpClause[];
  namedEntities: Map<string, string[]>;
}

export class NerAgent {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Processes input text to extract and resolve named entities.
   * Returns both the parsed clauses and resolved entity mappings.
   */
  async processText(inputText: string): Promise<NerResult> {
    const clauses = recognizeEntityGroups(inputText);
    const namedEntities = await this.resolveEntities(clauses);

    return { clauses, namedEntities };
  }

  /**
   * Resolves entities by searching the knowledge base for each entity text.
   * Uses caching to avoid duplicate searches.
   */
  private async resolveEntities(
    clauses: NlpClause[],
  ): Promise<Map<string, string[]>> {
    const searchCache = new Map<string, string[]>();

    for (const clause of clauses) {
      for (const entity of clause.entities) {
        if (searchCache.has(entity.text)) {
          continue;
        }

        const results = await this.searchService.search(entity.text);
        searchCache.set(entity.text, results);
      }
    }

    return searchCache;
  }

  /**
   * Logs the processing results in a readable format.
   */
  logResults(result: NerResult): void {
    console.log("=== Named Entity Recognition Results ===");

    for (const clause of result.clauses) {
      console.log(`Clause: "${clause.text}"`);

      for (const entity of clause.entities) {
        const resolved = result.namedEntities.get(entity.text) ?? [];
        console.log(`  Entity: "${entity.text}" -> [${resolved.join(", ")}]`);
      }
    }
  }
}
