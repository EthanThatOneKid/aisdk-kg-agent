import { z } from "zod";

/**
 * SearchService searches for candidates in the knowledge graph from the input text.
 */
export interface SearchService {
  search(request: SearchRequest): Promise<SearchResponse>;
}

/**
 * SearchHit is a candidate found in the knowledge graph search.
 */
export type SearchHit = z.infer<typeof searchHitSchema>;

export const searchHitSchema = z.object({
  score: z.number().describe("The confidence score of the relevance."),
  subject: z.string().describe(
    "The subject ID of the candidate found in the knowledge graph.",
  ),
  // predicate: z.string().describe(
  //   "The predicate of the candidate found in the knowledge graph.",
  // ),
  // object: z.string().describe(
  //   "The object of the candidate found in the knowledge graph.",
  // ),
});

/**
 * SearchRequest is a request to search for candidates in the knowledge graph from the input text.
 */
export type SearchRequest = z.infer<typeof searchRequest>;

export const searchRequest = z.object({
  text: z.string(),
  hits: searchHitSchema.array().optional(),
});

/**
 * SearchResponse is a response from searching for candidates in the knowledge graph.
 */
export type SearchResponse = z.infer<typeof searchResponse>;

export const searchResponse = z.object({
  text: z.string(),
  hits: z.array(searchHitSchema)
    .describe("The candidates found in the knowledge graph search."),
});
