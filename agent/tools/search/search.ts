import { z } from "zod";
import { tool } from "ai";
import type { SearchService } from "#/search/search.ts";

export interface SearchToolOptions {
  service: SearchService;
}

export function search({ service }: SearchToolOptions) {
  return tool({
    description: "Execute a search query",
    inputSchema: z.object({
      query: z.string().describe("The search query to execute"),
    }),
    outputSchema: z.object({
      result: z.array(z.string()).describe("The list of search results"),
    }),
    execute: async ({ query }) => {
      const result = await service.search(query);
      return { result };
    },
  });
}
