import { z } from "zod";

export type NerOffset = z.infer<typeof nerOffsetSchema>;

export const nerOffsetSchema = z.object({
  index: z.number(),
  start: z.number(),
  length: z.number(),
});

export type NerEntity = z.infer<typeof nerEntitySchema>;

export const nerEntitySchema = z.object({
  text: z.string(),
  type: z.string(),
  offset: nerOffsetSchema,
});
