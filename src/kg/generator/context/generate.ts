import type { ModelMessage } from "ai";
import type { GenerateTurtleOptions } from "src/kg/generator/generate.ts";
import { fewShot } from "./few-shot.ts";

/**
 * generateTurtleContext renders the context for the Turtle generation.
 *
 * @see https://context.addy.ie/
 */
export function generateTurtleContext(
  options: GenerateTurtleOptions,
): ModelMessage[] {
  return [
    {
      role: "system",
      content:
        `You are an expert Turtle generator. You will be given a user prompt and you will generate a valid Turtle RDF graph. The current date is ${options.timestamp}.`,
    },
    ...fewShot.flatMap((example): ModelMessage[] => {
      return [
        { role: "user", content: example.input },
        { role: "assistant", content: example.output },
      ];
    }),
    { role: "user", content: options.inputText },
  ];
}
