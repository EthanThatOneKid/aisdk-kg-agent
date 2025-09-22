import { Experimental_Agent as Agent } from "ai";
import { google } from "@ai-sdk/google";
import { isValidTurtle } from "#/turtle/validate.ts";

export const turtleAgent = new Agent({
  model: google("models/gemini-2.5-flash"),
  system: [
    "You are an expert in RDF and linked data.",
    "Your sole purpose is to generate valid Turtle (TTL) triples from user text.",
    "Always declare required prefixes at the top.",
    "Only output valid Turtle, nothing else.",
  ].join("\n"),
});

export async function generateValidTurtle(
  agent: typeof turtleAgent,
  prompt: string,
  maxRetries = 2,
): Promise<string> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: prompt },
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { text } = await agent.generate({ messages });
    const sanitized = trimFence(text.trim());
    const validation = isValidTurtle(sanitized);
    if (validation.ok) {
      return sanitized;
    }

    const feedback = [
      "The previous Turtle output was invalid.",
      `Parser error: ${validation.error}`,
      "Please correct the errors and re-output valid Turtle only (no code fences).",
    ].join("\n\n");

    messages.push(
      { role: "assistant", content: text },
      { role: "user", content: feedback },
    );
  }

  throw new Error(
    `Failed to generate valid Turtle after ${maxRetries} attempts.`,
  );
}

function trimFence(text: string): string {
  const fenced = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (fenced) {
    return fenced[1].trim();
  }

  return text.replace(/```[a-zA-Z]*|```/g, "").trim();
}
