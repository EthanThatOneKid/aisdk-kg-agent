import { z } from "zod";

/**
 * NerInterface recognizes entities from text.
 */
export interface NerInterface {
  recognize(text: string): Promise<NerEntity[]>;
}

/**
 * NerOffset is the location of an entity in text.
 */
export type NerOffset = z.infer<typeof nerOffsetSchema>;

export const nerOffsetSchema = z.object({
  index: z.number(),
  start: z.number(),
  length: z.number(),
});

/**
 * NerEntity is an entity extracted from text.
 */
export type NerEntity = z.infer<typeof nerEntitySchema>;

/**
 * NerEntity is an entity recognized from text.
 */
export const nerEntitySchema = z.object({
  text: z.string(),
  offset: nerOffsetSchema,
});
