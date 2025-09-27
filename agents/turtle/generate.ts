import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import { validateTurtle } from "n3store/shacl/validate.ts";
import { generateTurtleContext } from "./context/generate.ts";
import type { GeneratedTurtle } from "./schema.ts";
import { generatedTurtleSchema } from "./schema.ts";

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
