import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import { generateTurtleContext } from "./context/generate.ts";
import type { GeneratedTurtle } from "./schema.ts";
import { generatedTurtleSchema } from "./schema.ts";

/**
 * GenerateTurtleOptions are the options for Turtle generation.
 */
export interface GenerateTurtleOptions {
  model: LanguageModel;
  inputText: string;
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
  const result = await generateObject({
    model: options.model,
    temperature: options.temperature ?? 0.1,
    schema: generatedTurtleSchema,
    messages: generateTurtleContext(options),
  });

  return result.object;
}
