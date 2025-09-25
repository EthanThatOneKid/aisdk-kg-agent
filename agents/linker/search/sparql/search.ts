import type { QueryEngine } from "@comunica/query-sparql";
import type {
  SearchRequest,
  SearchResponse,
  SearchService,
} from "agents/linker/search/service.ts";

export class SparqlSearchService implements SearchService {
  constructor(
    private readonly queryEngine: QueryEngine,
    // deno-lint-ignore no-explicit-any
    private readonly options: any,
  ) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    // Search for entities that match the input text using FILTER
    const sparqlQuery = `
      SELECT DISTINCT ?entity ?object WHERE {
        ?entity ?predicate ?object .
        FILTER(isLiteral(?object) && datatype(?object) = xsd:string)
        FILTER(CONTAINS(LCASE(?object), LCASE("${
      request.text.replace(/"/g, '\\"')
    }")))
      }
      LIMIT 10
    `;

    const bindingsStream = await this.queryEngine.queryBindings(
      sparqlQuery,
      this.options,
    );

    // Convert bindings to search hits
    const hits: Array<{ subject: string; score: number }> = [];

    bindingsStream.on("data", (binding) => {
      const entity = binding.get("entity")?.value;
      if (entity) {
        hits.push({
          subject: entity,
          score: 1.0, // Simple scoring - could be improved with relevance scoring
        });
      }
    });

    await new Promise((resolve, reject) => {
      bindingsStream.on("end", resolve);
      bindingsStream.on("error", reject);
    });

    return { text: request.text, hits };
  }
}
