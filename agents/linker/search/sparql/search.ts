import type { QueryEngine } from "@comunica/query-sparql";
import type {
  SearchHit,
  SearchRequest,
  SearchResponse,
  SearchService,
} from "agents/linker/search/service.ts";

// TODO: Implement <https://www.npmjs.com/package/@comunica/query-sparql-reasoning>.

export class SparqlSearchService implements SearchService {
  constructor(
    private readonly queryEngine: QueryEngine,
    // deno-lint-ignore no-explicit-any
    private readonly options: any,
  ) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    // Search for entities that match the input text using FILTER and count occurrences.
    const sparqlQuery = `
      SELECT ?subject (COUNT(?object) AS ?frequency) WHERE {
        ?subject ?predicate ?object .
        FILTER(isLiteral(?object) && datatype(?object) = xsd:string)
        FILTER(CONTAINS(LCASE(?object), LCASE("${
      request.text.replace(/"/g, '\\"')
    }")))
      }
      GROUP BY ?subject
      ORDER BY DESC(?frequency)
      LIMIT 10
    `;

    const bindingsStream = await this.queryEngine.queryBindings(
      sparqlQuery,
      this.options,
    );

    // Convert bindings to search hits.
    const hits: SearchHit[] = [];

    bindingsStream.on("data", (binding) => {
      const subject = binding.get("subject")?.value;
      const frequency = binding.get("frequency")?.value;
      if (subject && frequency) {
        // Convert frequency to number and use as score.
        const score = parseInt(frequency, 10);
        hits.push({
          subject,
          score,
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
