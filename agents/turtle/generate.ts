import type { LanguageModel, ModelMessage } from "ai";
import { generateText } from "ai";
import type { LinkedEntity } from "agents/linker/entity-linker.ts";
import { validateTurtle } from "./shacl/validate.ts";
import { examples } from "./few-shot.ts";
import { generateIdTool } from "./tools/generate-id/tool.ts";

interface GenerateTurtleContext {
  inputText: string;
  linkedEntities?: LinkedEntity[];
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

  // Build prompt sections programmatically.
  const hasLinkedEntities = context.linkedEntities &&
    context.linkedEntities.length > 0;

  // 1. Task context
  const taskContext =
    "You are an expert episodic memory extractor for RDF knowledge graphs. Your role is to convert natural language stream of consciousness into valid Turtle (TTL) using schema.org vocabulary to faithfully capture episodes (who/what/when/where).";

  // 2. Tone context
  const toneContext =
    "Maintain precision and consistency. Be thorough in entity identification and relationship mapping. Follow RDF best practices strictly. CRITICAL: Only create triples that are directly evidenced by the user input - do not fabricate, infer, or add information not explicitly mentioned.";

  // 3. Background data
  const backgroundData =
    "You have access to schema.org vocabulary, SHACL validation shapes, and a generateId tool for creating unique HTTP URIs. Use the provided references to map surface strings to subject IRIs exactly.";

  // 4. Linked entities section
  let linkedEntitiesSection = "";
  if (hasLinkedEntities) {
    const linkedEntitiesList = context.linkedEntities!.map((linkedEntity) => {
      const entityText = linkedEntity.entity.text;
      const hit = linkedEntity.hit;
      if (hit) {
        return `Entity "${entityText}" -> Found existing ID: ${hit.subject} (confidence: ${hit.score})`;
      } else {
        return `Entity "${entityText}" -> No existing match found (needs new ID)`;
      }
    }).join("\n");
    linkedEntitiesSection = `\nLINKED ENTITIES:\n${linkedEntitiesList}\n`;
  }

  // 5. Core requirements
  const coreRequirements = [
    "Core Requirements:",
    "- EVIDENCE-BASED ONLY: Create triples ONLY for information explicitly mentioned in the user input. Do not infer, assume, or fabricate any properties, relationships, or entities not directly stated. Do not add temporal information (times, dates, durations) unless explicitly provided. Do not add status information (completed, pending, etc.) unless explicitly stated",
  ];

  // Add entity-specific requirements based on context.
  if (hasLinkedEntities) {
    coreRequirements.push(
      "- LINKED ENTITIES: Use the linked entities provided above. Entities with existing IDs should use those IDs. Entities without matches need new IDs generated.",
      "- ID RESOLUTION STRATEGY: For each entity in the linked entities list: (1) If it has a hit with an existing ID, use that ID, (2) If it has no hit (null), use generateId tool to create a new ID",
      "- MANDATORY: Use the existing entity IDs from the linked entities data for entities that were found. Generate new IDs only for entities without matches (hit is null).",
    );
  } else {
    coreRequirements.push(
      "- NEW ENTITIES: No linked entities were provided, so you can proceed directly to generating new IDs for all entities",
      "- ID RESOLUTION STRATEGY: Since no linked entities were provided, use generateId tool to create new IDs for all entities",
      "- MANDATORY: Before generating any Turtle, you MUST generate new IDs for all entities using the generateId tool",
    );
  }

  // Add common requirements.
  coreRequirements.push(
    "- CRITICAL: NEVER use hardcoded IDs like 'meetup1', 'action1', 'event1', etc. Always use proper ID resolution",
    "- MANDATORY TOOL USAGE: You MUST call the generateId tool for EVERY entity before creating any Turtle triples. Do not create any triples without first generating IDs for all entities.",
    "- NO HARDCODED URIs: Never use hardcoded URIs like 'https://fartlabs.org/.well-known/genid/world!_CreativeWork'. Always call generateId tool to get proper IDs.",
    `- Use only allowlisted prefixes: ${
      allowedPrefixes.join(", ")
    }. Expand to full IRIs instead of introducing new prefixes`,
    "- Prefer schema.org vocabulary for Actions, Events, CreativeWorks, and Places",
    "- Capture ONLY episode information explicitly mentioned: agent, object, location. Do not add time/status unless explicitly stated",
    "- Use typed literals with xsd (xsd:date, xsd:dateTime, xsd:decimal, xsd:duration)",
    "- Prefer named HTTP(S) IRIs over blank nodes whenever possible",
    "- Reuse identical IRIs across triples; do not alias or paraphrase",
    "- DESCRIPTIVE CONTENT: For Actions and Events, include schema:name and schema:description predicates when the input provides descriptive information. Use the natural language input to create meaningful labels and descriptions. You may also use rdfs:label for additional labeling.",
  );

  // 6. Examples and guidance
  const examplesGuidance = [
    "See the provided few-shot examples for proper Turtle structure and entity modeling patterns.",
    "IMPORTANT: If input says 'I met Kyle yesterday morning', do NOT add specific times like '09:00:00' or statuses like 'CompletedActionStatus' - only include what was explicitly mentioned.",
    "DESCRIPTIVE EXAMPLE: For input 'I met up with Kyle at the Lost Bean cafe', the Action should include: schema:name 'Meet up with Kyle' and schema:description 'Meeting with Kyle at the Lost Bean cafe'.",
  ];

  // 7. Workflow steps
  const workflowSteps = [
    "MANDATORY WORKFLOW - YOU MUST FOLLOW THESE STEPS:",
  ];

  // Add workflow steps based on context.
  if (hasLinkedEntities) {
    workflowSteps.push(
      "STEP 1: USE PROVIDED LINKED ENTITIES - Use the linked entities provided above. These have already been processed and linked to the knowledge graph where possible.",
      "STEP 2: ID RESOLUTION FROM LINKED ENTITIES - For each linked entity: (1) If it has a hit with an existing ID, use that ID, (2) If it has no hit (null), use generateId tool to create a new ID",
      "STEP 3: Map entities to resolved IRIs (from linked entity hits or generated IDs)",
      "STEP 4: Determine appropriate schema.org types (Action, Event, CreativeWork, Place) based ONLY on explicit mentions",
      "STEP 5: Capture ONLY relationships and properties explicitly mentioned (agent, object, location) - do not infer or add properties, especially temporal or status information",
      "STEP 6: Add descriptive content (schema:name, schema:description) for Actions and Events based on the natural language input",
      "STEP 7: Generate valid Turtle with proper prefixes and syntax, including ONLY evidenced information",
    );
  } else {
    workflowSteps.push(
      "STEP 1: NATURAL ENTITY IDENTIFICATION - Use your natural language understanding to identify all entities EXPLICITLY mentioned in the input (people, places, actions, events, objects). Do not rely on preprocessing - identify entities directly from the text.",
      "STEP 2: ID RESOLUTION - For each identified entity, use the generateId tool to create a new ID",
      "STEP 3: Map entities to resolved IRIs (from generated IDs)",
      "STEP 4: Determine appropriate schema.org types (Action, Event, CreativeWork, Place) based ONLY on explicit mentions",
      "STEP 5: Capture ONLY relationships and properties explicitly mentioned (agent, object, location) - do not infer or add properties, especially temporal or status information",
      "STEP 6: Add descriptive content (schema:name, schema:description) for Actions and Events based on the natural language input",
      "STEP 7: Generate valid Turtle with proper prefixes and syntax, including ONLY evidenced information",
    );
  }

  // Add common guidance.
  workflowSteps.push(
    "ENTITY IDENTIFICATION: Trust your natural language understanding over any preprocessing. Identify entities directly from the input text context.",
  );

  // 8. Output formatting
  const outputFormatting =
    "Output contract: Only output valid Turtle. No prose, no code fences, no explanations. Start with prefix declarations, then entity definitions.";

  // 9. Validation checklist
  const validationChecklist = [
    "Final validation checklist:",
  ];

  // Add context-specific validation items.
  if (hasLinkedEntities) {
    validationChecklist.push(
      "(1) PRIORITY: Used linked entities data to resolve existing IDs where available",
      "(2) Followed ID resolution strategy: linked entity hits → generateId (for entities without hits)",
      "(5) Mapped entities to resolved IRIs (linked entity hits or generated)",
    );
  } else {
    validationChecklist.push(
      "(1) PRIORITY: Identified entities from input text and generated new IDs for all",
      "(2) Followed ID resolution strategy: generateId for all entities",
      "(5) Mapped entities to resolved IRIs (generated)",
    );
  }

  // Add common validation items.
  validationChecklist.push(
    "(3) Called generateId tool ONLY for entities with no existing ID found",
    "(4) Used only allowlisted prefixes",
    "(6) Included ONLY agent/object/location explicitly mentioned in input (no inferred time/status)",
    "(7) Used schema.org Actions/Events/CreativeWorks/Places based on explicit mentions only",
    "(8) Added descriptive content (schema:name, schema:description) for Actions and Events",
    "(9) Used typed literals with xsd",
    "(10) Preferred named nodes over blank nodes",
    "(11) Ensured Turtle parses correctly",
    "(12) CRITICAL: Did not fabricate, infer, or add any information not explicitly stated in the user input",
  );

  // Combine all sections.
  const systemPrompt = [
    taskContext,
    toneContext,
    backgroundData,
    linkedEntitiesSection,
    ...coreRequirements,
    ...examplesGuidance,
    "Previous context: You are processing user input with entity references and optional timestamp.",
    "Current task: Convert the provided natural language input into valid Turtle RDF, ensuring all entities have proper HTTP URIs. IMPORTANT: Only include information explicitly stated in the input - do not add times, dates, statuses, or other inferred information.",
    ...workflowSteps,
    outputFormatting,
    ...validationChecklist,
  ].join("\n");

  const fewShot: ModelMessage[] = examples.flatMap((
    example,
  ): ModelMessage[] => [
    { role: "user", content: example.input },
    { role: "assistant", content: example.output },
  ]);

  // Build consolidated user message.
  let userContent = `Here is the input text:\n${context.inputText}`;
  if (context.timestamp !== undefined) {
    userContent += `\n\nHere is the timestamp:\n${context.timestamp}`;
  }

  const messages: ModelMessage[] = [
    ...fewShot,
    { role: "user", content: userContent },
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
          verbose: false,
        }),
      },
      system: systemPrompt,
      messages,
    });

    // Get the generated text (tools are handled automatically by generateText).
    const text = result.text;
    console.log(`📝 Generated text length: ${text.length}`);
    console.log(
      `📝 Generated text preview: "${text.substring(0, 100)}..."`,
    );
    console.log(`🔄 Total steps executed: ${result.steps.length}`);

    // Log tool calls from all steps.
    const allToolCalls = result.steps.flatMap((step) => step.toolCalls);
    console.log(`🔧 Total tool calls: ${allToolCalls.length}`);

    // Log tool call details
    if (allToolCalls.length > 0) {
      console.log(`🔧 Tool calls made:`);
      allToolCalls.forEach((call, index) => {
        console.log(
          `  ${index + 1}. ${call.toolName}: ${JSON.stringify(call)}`,
        );
      });
    }

    // Log linked entities usage if provided.
    if (context.linkedEntities && context.linkedEntities.length > 0) {
      console.log(
        `✅ Using linked entities data: ${context.linkedEntities.length} entities provided`,
      );
    }

    const trimmed = trimFence(text.trim());

    // Check if the sanitized text is empty
    if (!trimmed || trimmed.trim().length === 0) {
      const feedback = [
        "The previous output was empty or contained no valid Turtle content.",
        "You must generate actual Turtle triples using the IDs from the generateId tool calls.",
        "Please output valid Turtle with proper triples using the generated IDs.",
      ].join("\n\n");
      console.log("Empty output feedback:", feedback);

      // Add the response messages to conversation history for multi-step calls.
      messages.push(...result.response.messages);
      messages.push({ role: "user", content: feedback });
      continue;
    }

    // Validate Turtle syntax and SHACL compliance (if schema provided)
    const validationResult = await validateTurtle({
      graphText: trimmed,
      schemaText: context.shaclShapes,
    });

    if (!validationResult.isValid) {
      const feedback = [
        "The previous Turtle output was invalid.",
        `Validation errors: ${validationResult.errorText ?? "Unknown"}`,
        "Please correct the errors and re-output valid Turtle only.",
      ].join("\n\n");
      console.log("Validation feedback:", feedback);

      // Add the response messages to conversation history for multi-step calls.
      messages.push(...result.response.messages);
      messages.push({ role: "user", content: feedback });
      continue;
    }

    console.log(`🎉 Success! Generated valid Turtle`);
    return trimmed;
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
