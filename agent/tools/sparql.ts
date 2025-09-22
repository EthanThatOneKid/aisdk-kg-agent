import { z } from "zod";
import { tool } from "ai";
import type { QueryEngine } from "@comunica/query-sparql";
import type { IQueryContextCommon } from "@comunica/types";
import { sparqlSchema } from "#/sparql/zod.ts";

export interface SparqlToolOptions {
  queryEngine: QueryEngine;
  context?: IQueryContextCommon;
}

export function sparql({ queryEngine, context }: SparqlToolOptions) {
  return tool({
    description: "Execute a SPARQL query",
    inputSchema: z.object({
      query: sparqlSchema.describe("The SPARQL query to execute"),
    }),
    execute: async ({ query }) => {
      const result = await queryEngine.query(query, context);
      const resultString = await queryEngine.resultToString(result);
      console.log({ query, resultString });
      return { query };
    },
  });
}
