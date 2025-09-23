import type { LanguageModel, ModelMessage } from "ai";
import { Experimental_Agent as Agent } from "ai";

export interface SparqlContext {
  inputText: string;
  references: Array<[string, string]>;
  allowedPrefixes?: string[];
  generateTimestamp?: () => string;
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

export async function generateSparql(
  model: LanguageModel,
  context: SparqlContext,
) {
  const allowedPrefixes = context.allowedPrefixes ?? defaultAllowedPrefixes;
  const agent = new Agent({
    model,
    system: [
      "You are an expert in RDF and linked data that converts natural language into SPARQL queries.",
      "Your sole purpose is to generate valid SPARQL INSERT queries from user text.",
      "Always declare required prefixes at the top.",
      `Use only these prefixes: ${
        allowedPrefixes.join(", ")
      }. Do not introduce any others; expand to full IRIs instead.`,
      "Use the mappings provided to map the natural language to the SPARQL query.",
      "Only output valid SPARQL INSERT queries, nothing else.",
    ].join("\n"),
  });

  const result = await agent.generate({
    messages: [
      {
        role: "user",
        content:
          "Generate a SPARQL INSERT query for the following natural language:",
      },
      { role: "user", content: context.inputText },
      {
        role: "user",
        content: [
          "Here are the references you can use to map the natural language to the SPARQL query:",
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
      { role: "assistant", content: "Here is the SPARQL INSERT query:" },
    ],
  });

  console.dir(result, { depth: null });
  return result.text;
}
