import type { ModelMessage } from "ai";
import type { GenerateTurtleOptions } from "agents/turtle/generate.ts";

/**
 * generateTurtleContext renders the context for the Turtle generation.
 *
 * @see https://context.addy.ie/
 */
export function generateTurtleContext(
  options: GenerateTurtleOptions,
): ModelMessage[] {
  return [
    { role: "user", content: options.inputText },
  ];
}
