import type { LanguageModel, ModelMessage } from "ai";
import { generateText, stepCountIs } from "ai";
import { validateTurtle } from "./shacl/validate.ts";
import { examples } from "./few-shot.ts";
import { sparqlTool } from "./tools/sparql/tool.ts";
import { generateIdTool } from "./tools/generate-id/tool.ts";

interface GenerateTurtleContext {
  inputText: string;
  references: Array<[string, string]>;
  allowedPrefixes?: string[];
  timestamp?: string;
  maxRetries?: number;
  shaclShapes?: string;
  temperature?: number;
  sources?: unknown[]; // SPARQL data sources (e.g., N3 stores, endpoints)
  reconnaissanceContext?: string; // Context about entities needing SPARQL reconnaissance
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

  const systemPrompt = [
    // 1. Task context
    "You are an expert episodic memory extractor for RDF knowledge graphs. Your role is to convert natural language stream of consciousness into valid Turtle (TTL) using schema.org vocabulary to faithfully capture episodes (who/what/when/where).",

    // 2. Tone context
    "Maintain precision and consistency. Be thorough in entity identification and relationship mapping. Follow RDF best practices strictly. CRITICAL: Only create triples that are directly evidenced by the user input - do not fabricate, infer, or add information not explicitly mentioned.",

    // 3. Background data, documents, and images
    "You have access to schema.org vocabulary, SHACL validation shapes, a generateId tool for creating unique HTTP URIs, and a sparql tool for querying existing knowledge graph data. The sparql tool is your PRIMARY method for finding existing entity IDs - use it FIRST before generating new IDs. Use the provided references to map surface strings to subject IRIs exactly.",
    context.reconnaissanceContext
      ? `\nRECONNAISSANCE CONTEXT:\n${context.reconnaissanceContext}\n`
      : "",

    // 4. Detailed task description & rules
    "Core Requirements:",
    "- EVIDENCE-BASED ONLY: Create triples ONLY for information explicitly mentioned in the user input. Do not infer, assume, or fabricate any properties, relationships, or entities not directly stated. Do not add temporal information (times, dates, durations) unless explicitly provided. Do not add status information (completed, pending, etc.) unless explicitly stated",
    "- RECONNAISSANCE FIRST: ALWAYS start by using the sparql tool to query existing data about entities. This is your PRIMARY method for finding existing IDs and avoiding duplication",
    "- ID RESOLUTION STRATEGY: Follow this exact order: (1) Check provided references, (2) Query existing data via sparql tool, (3) Only if no existing ID found, use generateId tool as fallback",
    "- MANDATORY: Before generating any Turtle, you MUST resolve ALL entity IDs using the above strategy",
    "- CRITICAL: NEVER use hardcoded IDs like 'meetup1', 'action1', 'event1', etc. Always use proper ID resolution",
    "- Use only allowlisted prefixes: " + allowedPrefixes.join(", ") +
    ". Expand to full IRIs instead of introducing new prefixes",
    "- Prefer schema.org vocabulary for Actions, Events, CreativeWorks, and Places",
    "- Capture ONLY episode information explicitly mentioned: agent, object, location. Do not add time/status unless explicitly stated",
    "- Use typed literals with xsd (xsd:date, xsd:dateTime, xsd:decimal, xsd:duration)",
    "- Prefer named HTTP(S) IRIs over blank nodes whenever possible",
    "- Reuse identical IRIs across triples; do not alias or paraphrase",
    "- DESCRIPTIVE CONTENT: For Actions and Events, include schema:name and schema:description predicates when the input provides descriptive information. Use the natural language input to create meaningful labels and descriptions. You may also use rdfs:label for additional labeling.",

    // 5. Examples (referenced via few-shot examples)
    "See the provided few-shot examples for proper Turtle structure and entity modeling patterns.",
    "IMPORTANT: If input says 'I met Kyle yesterday morning', do NOT add specific times like '09:00:00' or statuses like 'CompletedActionStatus' - only include what was explicitly mentioned.",
    "DESCRIPTIVE EXAMPLE: For input 'I met up with Kyle at the Lost Bean cafe', the Action should include: schema:name 'Meet up with Kyle' and schema:description 'Meeting with Kyle at the Lost Bean cafe'.",

    // 6. Conversation history
    "Previous context: You are processing user input with entity references and optional timestamp.",

    // 7. Immediate task description or request
    "Current task: Convert the provided natural language input into valid Turtle RDF, ensuring all entities have proper HTTP URIs. IMPORTANT: Only include information explicitly stated in the input - do not add times, dates, statuses, or other inferred information.",

    // 8. Thinking step by step / take a deep breath
    "MANDATORY WORKFLOW - YOU MUST FOLLOW THESE STEPS:",
    "STEP 1: NATURAL ENTITY IDENTIFICATION - Use your natural language understanding to identify all entities EXPLICITLY mentioned in the input (people, places, actions, events, objects). Do not rely on preprocessing - identify entities directly from the text.",
    "STEP 2: MANDATORY SPARQL RECONNAISSANCE - You MUST call the sparql tool for EACH identified entity to check for existing data. This is NOT optional.",
    "STEP 3: For each entity, follow ID resolution in this EXACT order:",
    "   a) MANDATORY: Query existing data via sparql tool to find existing IDs",
    "   b) Only if no existing ID found, use generateId tool as fallback",
    "STEP 4: Map entities to resolved IRIs (from sparql results or generated IDs)",
    "STEP 5: Determine appropriate schema.org types (Action, Event, CreativeWork, Place) based ONLY on explicit mentions",
    "STEP 6: Capture ONLY relationships and properties explicitly mentioned (agent, object, location) - do not infer or add properties, especially temporal or status information",
    "STEP 7: Add descriptive content (schema:name, schema:description) for Actions and Events based on the natural language input",
    "STEP 8: Generate valid Turtle with proper prefixes and syntax, including ONLY evidenced information",
    "",
    "CRITICAL: You CANNOT skip the sparql tool calls. If you generate Turtle without calling sparql first, you are violating the core requirements.",
    "ENTITY IDENTIFICATION: Trust your natural language understanding over any preprocessing. Identify entities directly from the input text context.",

    // 9. Output formatting
    "Output contract: Only output valid Turtle. No prose, no code fences, no explanations. Start with prefix declarations, then entity definitions.",

    // 10. Prefilled response (if any)
    "Final validation checklist:",
    "(1) PRIORITY: Used sparql tool FIRST to query existing data about entities",
    "(2) Followed ID resolution strategy: references → sparql → generateId (fallback only)",
    "(3) Called generateId tool ONLY for entities with no existing ID found",
    "(4) Used only allowlisted prefixes",
    "(5) Mapped entities to resolved IRIs (references, sparql results, or generated)",
    "(6) Included ONLY agent/object/location explicitly mentioned in input (no inferred time/status)",
    "(7) Used schema.org Actions/Events/CreativeWorks/Places based on explicit mentions only",
    "(8) Added descriptive content (schema:name, schema:description) for Actions and Events",
    "(9) Used typed literals with xsd",
    "(10) Preferred named nodes over blank nodes",
    "(11) Ensured Turtle parses correctly",
    "(12) CRITICAL: Did not fabricate, infer, or add any information not explicitly stated in the user input",
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

    const result = await generateText({
      model,
      temperature: context.temperature ?? 0.1,
      tools: {
        generateId: generateIdTool({
          generate: () =>
            `https://fartlabs.org/.well-known/genid/${crypto.randomUUID()}`,
          verbose: true,
        }),
        sparql: sparqlTool({
          sources: context.sources ?? [], // Use provided sources or empty array
          verbose: true,
        }),
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

    // Log SPARQL tool usage specifically
    const sparqlCalls = allToolCalls.filter((call) =>
      call.toolName === "sparql"
    );
    console.log(`🔍 SPARQL reconnaissance calls: ${sparqlCalls.length}`);

    // VALIDATION: Check if SPARQL tool was used
    if (sparqlCalls.length === 0) {
      console.warn("⚠️  WARNING: No SPARQL reconnaissance calls detected!");
      console.warn(
        "⚠️  The LLM should have called the sparql tool to check for existing entities.",
      );
      console.warn(
        "⚠️  This may indicate the LLM is not following the mandatory workflow.",
      );
    } else {
      console.log(
        `✅ SPARQL reconnaissance completed: ${sparqlCalls.length} queries executed`,
      );
    }

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
          console.log(`🎉 Success! Generated valid Turtle`);
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

      console.log(`🎉 Success! Generated valid Turtle`);
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
