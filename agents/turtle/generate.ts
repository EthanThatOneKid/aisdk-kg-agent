import type { LanguageModel, ModelMessage } from "ai";
import { Experimental_Agent as Agent } from "ai";
import { validateTurtle } from "./validate.ts";

interface GenerateTurtleContext {
  inputText: string;
  references: Array<[string, string]>;
  allowedPrefixes?: string[];
  generateTimestamp?: () => string;
  maxRetries?: number;
}

const defaultAllowedPrefixes = [
  "rdf",
  "rdfs",
  "schema",
  "foaf",
  "xsd",
  "geo",
  "owl",
  "skos",
  "dc",
  "dcterms",
];

export async function generateTurtle(
  model: LanguageModel,
  context: GenerateTurtleContext,
): Promise<string> {
  const maxRetries = context.maxRetries ?? 2;
  const allowedPrefixes = context.allowedPrefixes ?? defaultAllowedPrefixes;
  const agent = new Agent({
    model,
    system: [
      "You are an expert in RDF and linked data.",
      "Your sole purpose is to generate valid Turtle (TTL) triples from user text.",
      "Always declare required prefixes at the top.",
      `Use only these prefixes: ${
        allowedPrefixes.join(", ")
      }. Do not introduce any others; expand to full IRIs instead.`,
      "Use the mappings provided to map the natural language to the Turtle.",
      "Only output valid Turtle, nothing else.",
    ].join("\n"),
  });

  const messages: ModelMessage[] = [
    { role: "user", content: context.inputText },
    {
      role: "user",
      content: [
        "Here are the references you can use to map the natural language to the Turtle:",
        ...context.references
          .map(([text, subject]) => `- [${text}](${subject})`),
      ].join("\n"),
    },
    ...((context.generateTimestamp
      ? [
        { role: "user", content: "Here is the timestamp:" },
        { role: "user", content: context.generateTimestamp() },
      ]
      : []) as ModelMessage[]),
    { role: "assistant", content: "Here is the Turtle:" },
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { text } = await agent.generate({ messages });
    const sanitized = trimFence(text.trim());
    const validation = validateTurtle(sanitized);
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
