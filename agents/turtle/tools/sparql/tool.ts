import { tool } from "ai";
import { z } from "zod";
import { QueryEngine } from "@comunica/query-sparql";

export interface SparqlToolConfig {
  sources?: (string | unknown)[]; // URLs or N3 stores
  verbose?: boolean;
}

export function sparqlTool(config: SparqlToolConfig = {}) {
  const { sources = [], verbose = true } = config;
  return tool({
    description:
      "Query existing knowledge graph data to gather information about entities and avoid duplication. Use this to understand what data already exists before generating new Turtle.",
    inputSchema: z.object({
      query: z.string().describe(
        "SPARQL SELECT query to gather information about entities",
      ),
      purpose: z.string().describe(
        "Brief description of what information you're looking for (e.g., 'find existing data about Kyle', 'check for existing cafe information')",
      ),
    }),
    execute: async ({ query, purpose }) => {
      try {
        if (verbose) {
          console.log(`🔍 SPARQL recon: ${purpose}`);
          console.log(`📝 Query: ${query}`);
        }

        // If no sources configured, return empty results.
        if (sources.length === 0) {
          if (verbose) {
            console.log(
              `📊 SPARQL results: 0 bindings found (no existing data source configured)`,
            );
          }
          return {
            success: true,
            purpose,
            query,
            results: [],
            count: 0,
            note: "No existing data source configured - treating as new data",
          };
        }

        // Execute actual SPARQL query.
        const engine = new QueryEngine();
        const bindingsStream = await engine.queryBindings(query, {
          sources: sources as never, // Type assertion to handle both string URLs and N3 stores
        });

        const results: Record<string, string>[] = [];
        bindingsStream.on("data", (binding) => {
          const result: Record<string, string> = {};
          binding.forEach(
            (value: { value: string }, key: { value: string }) => {
              result[key.value] = value.value;
            },
          );
          results.push(result);
        });

        await new Promise((resolve, reject) => {
          bindingsStream.on("end", resolve);
          bindingsStream.on("error", reject);
        });

        if (verbose) {
          console.log(`📊 SPARQL results: ${results.length} bindings found`);
        }

        return {
          success: true,
          purpose,
          query,
          results,
          count: results.length,
        };
      } catch (error) {
        if (verbose) {
          console.log(`❌ SPARQL error: ${(error as Error).message}`);
        }
        return {
          success: false,
          purpose,
          query,
          error: (error as Error).message,
          results: [],
          count: 0,
        };
      }
    },
  });
}
