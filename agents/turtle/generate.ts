import type { LanguageModel, ModelMessage } from "ai";
import { Experimental_Agent as Agent } from "ai";
import { validateTurtle } from "./shacl/validate.ts";
import { examples } from "./few-shot.ts";

interface GenerateTurtleContext {
  inputText: string;
  references: Array<[string, string]>;
  allowedPrefixes?: string[];
  timestamp?: string;
  maxRetries?: number;
  shaclShapes?: string;
  temperature?: number;
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
  const maxRetries = context.maxRetries ?? 3;
  const allowedPrefixes = context.allowedPrefixes ?? defaultAllowedPrefixes;
  const agent = new Agent({
    model,
    temperature: context.temperature ?? 0.1,
    system: [
      "You are an expert episodic memory extractor for RDF knowledge graphs.",
      "Convert natural language into valid Turtle (TTL) using schema.org so that episodes (who/what/when/where) are faithfully captured.",
      "Always declare required prefixes at the top: rdf, schema, xsd (and only from the allowlist).",
      `Use only these prefixes: ${
        allowedPrefixes.join(", ")
      }. Do not introduce any others; expand to full IRIs instead.`,
      "Use the provided references to map surface strings to subject IRIs exactly; never change casing or structure of provided IRIs.",
      "Prefer schema.org vocabulary. Model activities using schema:Action (WatchAction, ListenAction, ReadAction, ViewAction, EatAction, DrinkAction, BuyAction, PayAction, OrderAction, CheckInAction, CommunicateAction, ReviewAction, CreateAction).",
      "For Actions capture: schema:agent, schema:object, schema:location, schema:actionStatus, schema:startTime/endTime, schema:instrument/result/recipient/participant when present.",
      "Use schema:Event (& subclasses) for happenings; link organizer/attendee/performer and use startDate/endDate.",
      "Use CreativeWork subclasses (Movie, TVEpisode, PodcastEpisode, Article, MusicRecording, VideoObject) for consumed/created items; Places (Restaurant, CafeOrCoffeeShop, BarOrPub, Park, LodgingBusiness) for venues.",
      "IRIs: Prefer named HTTP(S) IRIs only when explicitly provided in the input or references. Do NOT mint or invent any IRIs (no urn:, UUIDs, .well-known).",
      "Avoid blank nodes whenever possible — prefer named IRIs from references. If no IRI is provided, use literals (schema:name, schema:identifier). Use blank nodes only if required by validation.",
      'Time & units: Prefer typed literals with xsd (xsd:date, xsd:dateTime, xsd:decimal, xsd:duration). Normalize vague times only when clearly implied (e.g., "yesterday morning"). If a timestamp is provided separately, include it verbatim as a typed literal.',
      "Determinism: Reuse identical IRIs across triples; do not alias or paraphrase IRIs.",
      "Output contract: Only output valid Turtle. No prose, no code fences, no explanations.",
      "Final checklist: (1) No invented IRIs; (2) Use only allowlisted prefixes; (3) Map entities to provided IRIs via references; (4) Include agent/object/location/time/status when present; (5) Prefer schema.org Actions/Events/CreativeWorks/Places; (6) Use typed literals with xsd; (7) Prefer named nodes; (8) Ensure the Turtle parses.",
    ].join("\n"),
  });

  const fewShot: ModelMessage[] = examples.flatMap((
    example,
  ): ModelMessage[] => [
    { role: "user", content: example.input },
    { role: "assistant", content: example.output },
  ]);

  const messages: ModelMessage[] = [
    ...fewShot,
    { role: "user", content: "Here is the input text:" },
    { role: "user", content: context.inputText },
    {
      role: "user",
      content: [
        "Here are the references you can use to map the natural language to the Turtle:",
        ...context.references.map(([text, subject]) =>
          `- [${text}](${subject})`
        ),
      ].join("\n"),
    },
    ...((context.timestamp !== undefined
      ? [
        { role: "user", content: "Here is the timestamp:" },
        { role: "user", content: context.timestamp },
      ]
      : []) as ModelMessage[]),
    { role: "assistant", content: "Here is the Turtle:" },
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Attempt ${attempt}/${maxRetries} generating Turtle...`);
    const { text } = await agent.generate({ messages });
    const sanitized = trimFence(text.trim());
    // First, N3 syntax check via SHACL validator with no schema (it parses data).
    const syntaxRes = await validateTurtle({ graphText: sanitized });
    if (syntaxRes.isValid) {
      if (context.shaclShapes) {
        const shaclReport = await validateTurtle({
          graphText: sanitized,
          schemaText: context.shaclShapes,
        });
        if (shaclReport.isValid) {
          return sanitized;
        }

        const feedback = [
          "The previous Turtle output failed SHACL validation.",
          `Validation errors: ${shaclReport.errorText ?? "Unknown"}`,
          "Please correct the errors and re-output valid Turtle only.",
        ].join("\n\n");
        console.log("SHACL feedback:", feedback);

        messages.push(
          { role: "assistant", content: text },
          { role: "user", content: feedback },
        );
        continue;
      }

      return sanitized;
    }

    const feedback = [
      "The previous Turtle output was invalid.",
      `Parser error: ${syntaxRes.errorText ?? "Unknown"}`,
      "Please correct the errors and re-output valid Turtle only.",
    ].join("\n\n");
    console.log("Syntax feedback:", feedback);

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
