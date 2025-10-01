import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import { validateTurtle } from "src/n3store/shacl/validate.ts";
import { generateTurtleContext } from "./context/generate.ts";

/**
 * GenerateTurtleOptions are the options for Turtle generation.
 */
export interface GenerateTurtleOptions {
  model: LanguageModel;
  inputText: string;
  timestamp: string;
  shapes?: string;
  temperature?: number;
  verbose?: boolean;
}

/**
 * generateTurtle generates the Turtle RDF content with placeholder IDs.
 *
 * @see https://context.addy.ie/
 */
export async function generateTurtle(
  options: GenerateTurtleOptions,
): Promise<GeneratedTurtle> {
  const maxAttempts = 3;
  const context = generateTurtleContext(options);

  let attempts = 0;
  while (attempts < maxAttempts) {
    const result = await generateObject({
      model: options.model,
      temperature: options.temperature ?? 0.1,
      schema: generatedTurtleSchema,
      messages: context,
    });

    const errorText = await validateTurtle(
      result.object.turtle,
      options.shapes,
    );
    if (errorText === null) {
      return result.object;
    }

    context.push(
      { role: "assistant", content: JSON.stringify(result.object) },
      { role: "user", content: errorText },
    );

    attempts++;

    if (options.verbose) {
      console.log(`Attempt ${attempts + 1} failed: ${errorText}`);
    }
  }

  throw new Error("Failed to generate valid Turtle");
}

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
