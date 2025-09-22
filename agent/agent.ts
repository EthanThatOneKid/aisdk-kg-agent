import { Experimental_Agent as Agent } from "ai";
import { google } from "@ai-sdk/google";
// import { QueryEngine } from "@comunica/query-sparql";
// import { sparql } from "./tools/sparql.ts";
import { isValidTurtle } from "./turtle/validate.ts";

const gemini = google("models/gemini-2.5-flash");
// const queryEngine = new QueryEngine();

export type KgAgent = typeof agent;

export const agent = new Agent({
  model: gemini,
  system:
    "Extract facts from text and convert them into RDF triples in Turtle format.",
  tools: {
    // sparql: sparql({ queryEngine }),
  },
});

/**
 * Generates Turtle from input text using the provided agent.
 * Applies sanitize → validate → single-retry-on-parse-error → return.
 */
export async function generateTurtle(
  agent: KgAgent,
  inputText: string,
): Promise<{ turtle: string; rawText: string }> {
  // First attempt.
  let result = await agent.generate({
    prompt: `Analyze the following text:\n${inputText}`,
  });

  let sanitized = trimFence(result.text.trim());
  let validation = isValidTurtle(sanitized);
  if (!validation.ok) {
    const retryPrompt = [
      "Your previous output was not valid Turtle.",
      `Parser error: ${validation.error}`,
      "Re-output the triples as valid Turtle only. No explanations. Do not include code fences.",
      "Use the same instructions and prefixes.",
      "Input text:",
      inputText,
    ].join("\n\n");

    result = await agent.generate({ prompt: retryPrompt });
    sanitized = trimFence(result.text.trim());
    validation = isValidTurtle(sanitized);
  }

  if (!validation.ok) {
    throw new Error(
      `Failed to produce valid Turtle after retry. Parser error: ${validation.error}`,
    );
  }

  return { turtle: sanitized, rawText: result.text };
}

function trimFence(text: string) {
  const fenced = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (fenced) {
    return fenced[1].trim();
  }

  return text.replace(/```[a-zA-Z]*|```/g, "").trim();
}
