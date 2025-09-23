import type { LanguageModel, ModelMessage } from "ai";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
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

  // Track generated IDs to ensure consistency
  const generatedIds = new Map<string, string>();

  const generateIdTool = tool({
    description:
      "Generate a new unique HTTP URI for an entity that doesn't have a provided reference. Use this when you need to create a named node but don't have a specific IRI from the references.",
    inputSchema: z.object({
      entityName: z.string().describe(
        "A descriptive name for the entity (e.g., 'alice', 'centralPark', 'watchAction1')",
      ),
      entityType: z.string().describe(
        "The type of entity (e.g., 'person', 'place', 'action', 'event')",
      ),
    }),
    execute: ({ entityName, entityType }) => {
      // Create a consistent ID based on entity name and type
      const normalizedName = entityName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const key = `${normalizedName}-${entityType}`;
      if (!generatedIds.has(key)) {
        const id =
          `http://example.com/.well-known/genid/${crypto.randomUUID()}`;
        generatedIds.set(key, id);
        console.log(
          `✅ generateId tool: Generated new ID for ${entityName} (${entityType}) -> ${id}`,
        );
      } else {
        const existingId = generatedIds.get(key)!;
        console.log(
          `🔄 generateId tool: Reusing existing ID for ${entityName} (${entityType}) -> ${existingId}`,
        );
      }

      return generatedIds.get(key)!;
    },
  });

  const systemPrompt = [
    // 1. Task context
    "You are an expert episodic memory extractor for RDF knowledge graphs. Your role is to convert natural language stream of consciousness into valid Turtle (TTL) using schema.org vocabulary to faithfully capture episodes (who/what/when/where).",

    // 2. Tone context
    "Maintain precision and consistency. Be thorough in entity identification and relationship mapping. Follow RDF best practices strictly.",

    // 3. Background data, documents, and images
    "You have access to schema.org vocabulary, SHACL validation shapes, and a generateId tool for creating unique HTTP URIs. Use the provided references to map surface strings to subject IRIs exactly.",

    // 4. Detailed task description & rules
    "Core Requirements:",
    "- MANDATORY: Before generating any Turtle, you MUST call the generateId tool for every entity that doesn't have a provided reference",
    "- CRITICAL: NEVER use hardcoded IDs like 'meetup1', 'action1', 'event1', etc. Always call the generateId tool",
    "- Use only allowlisted prefixes: " + allowedPrefixes.join(", ") +
    ". Expand to full IRIs instead of introducing new prefixes",
    "- Prefer schema.org vocabulary for Actions, Events, CreativeWorks, and Places",
    "- Capture complete episode information: agent, object, location, time, status",
    "- Use typed literals with xsd (xsd:date, xsd:dateTime, xsd:decimal, xsd:duration)",
    "- Prefer named HTTP(S) IRIs over blank nodes whenever possible",
    "- Reuse identical IRIs across triples; do not alias or paraphrase",

    // 5. Examples (referenced via few-shot examples)
    "See the provided few-shot examples for proper Turtle structure and entity modeling patterns.",

    // 6. Conversation history
    "Previous context: You are processing user input with entity references and optional timestamp.",

    // 7. Immediate task description or request
    "Current task: Convert the provided natural language input into valid Turtle RDF, ensuring all entities have proper HTTP URIs.",

    // 8. Thinking step by step / take a deep breath
    "Process systematically:",
    "1. Identify all entities mentioned in the input",
    "2. For each entity without a provided reference, call generateId tool",
    "3. Map entities to provided IRIs via references (exact match)",
    "4. Determine appropriate schema.org types (Action, Event, CreativeWork, Place)",
    "5. Capture relationships and properties (agent, object, location, time, status)",
    "6. Generate valid Turtle with proper prefixes and syntax",

    // 9. Output formatting
    "Output contract: Only output valid Turtle. No prose, no code fences, no explanations. Start with prefix declarations, then entity definitions.",

    // 10. Prefilled response (if any)
    "Final validation checklist:",
    "(1) Called generateId tool for ALL entities without provided IRIs",
    "(2) Used only allowlisted prefixes",
    "(3) Mapped entities to provided IRIs via references",
    "(4) Included agent/object/location/time/status when present",
    "(5) Used schema.org Actions/Events/CreativeWorks/Places",
    "(6) Used typed literals with xsd",
    "(7) Preferred named nodes over blank nodes",
    "(8) Ensured Turtle parses correctly",
  ].join("\n");

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
    console.log(`📊 generateId tool calls so far: ${generatedIds.size}`);

    const result = await generateText({
      model,
      temperature: context.temperature ?? 0.1,
      tools: {
        generateId: generateIdTool,
      },
      system: systemPrompt,
      messages,
      stopWhen: stepCountIs(5), // Allow up to 5 steps for tool calls and text generation
    });

    // Get the generated text (tools are handled automatically by generateText)
    const text = result.text;
    console.log(`📝 Generated text length: ${text.length}`);
    console.log(
      `📝 Generated text preview: "${text.substring(0, 100)}..."`,
    );
    console.log(`🔄 Total steps executed: ${result.steps.length}`);

    // Log tool calls from all steps
    const allToolCalls = result.steps.flatMap((step) => step.toolCalls);
    console.log(`🔧 Total tool calls: ${allToolCalls.length}`);

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
          console.log(
            `🎉 Success! Generated valid Turtle with ${generatedIds.size} unique IDs`,
          );
          console.log(`📋 Final generateId tool summary:`);
          for (const [key, id] of generatedIds.entries()) {
            console.log(`   ${key} -> ${id}`);
          }
          return sanitized;
        }

        const feedback = [
          "The previous Turtle output failed SHACL validation.",
          `Validation errors: ${shaclReport.errorText ?? "Unknown"}`,
          "Please correct the errors and re-output valid Turtle only.",
        ].join("\n\n");
        console.log("SHACL feedback:", feedback);

        // Add the response messages to conversation history for multi-step calls
        messages.push(...result.response.messages);
        messages.push({ role: "user", content: feedback });
        continue;
      }

      console.log(
        `🎉 Success! Generated valid Turtle with ${generatedIds.size} unique IDs`,
      );
      console.log(`📋 Final generateId tool summary:`);
      for (const [key, id] of generatedIds.entries()) {
        console.log(`   ${key} -> ${id}`);
      }
      return sanitized;
    }

    const feedback = [
      "The previous Turtle output was invalid.",
      `Parser error: ${syntaxRes.errorText ?? "Unknown"}`,
      "Please correct the errors and re-output valid Turtle only.",
    ].join("\n\n");
    console.log("Syntax feedback:", feedback);

    // Add the response messages to conversation history for multi-step calls
    messages.push(...result.response.messages);
    messages.push({ role: "user", content: feedback });
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
