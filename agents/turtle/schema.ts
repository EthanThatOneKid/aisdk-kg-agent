import { z } from "zod";

/**
 * GeneratedTurtleVariable is a variable extracted from the input text.
 */
export type GeneratedTurtleVariable = z.infer<
  typeof generatedTurtleVariableSchema
>;

export const generatedTurtleVariableSchema = z.object({
  id: z.string().describe(
    "The variable ID like 'PLACEHOLDER_ENTITY_1'",
  ),
  type: z.string().describe(
    "The variable type like 'schema:Person' or 'schema:Event'",
  ),
  name: z.string().describe(
    "The name of the variable extracted from the input",
  ),
  text: z.string().describe(
    "The original text snippet from the input that led to this variable",
  ),
});

/**
 * GeneratedTurtle is Turtle RDF content with placeholder IDs.
 */
export type GeneratedTurtle = z.infer<typeof generatedTurtleSchema>;

export const generatedTurtleSchema = z.object({
  turtle: z.string()
    .describe("The generated Turtle RDF content with placeholder IDs"),
  variables: generatedTurtleVariableSchema
    .array()
    .describe("Array of variables extracted from the input text"),
});
