import type { LanguageModel, ModelMessage } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import { validateTurtle } from "./shacl/validate.ts";
import { examples } from "./few-shot.ts";

interface GenerateTurtleContext {
  inputText: string;
  allowedPrefixes?: string[];
  timestamp?: string;
  maxRetries?: number;
  shaclShapes?: string;
  temperature?: number;
  verbose?: boolean;
}

interface ExtractedEntity {
  placeholderId: string;
  entityType: string;
  entityName: string;
  sourceText: string;
}

interface GenerateTurtleResult {
  turtle: string;
  entities: ExtractedEntity[];
}

// Zod schema for structured output
const GenerateTurtleSchema = z.object({
  turtle: z.string().describe(
    "The generated Turtle RDF content with placeholder IDs",
  ),
  entities: z.array(z.object({
    placeholderId: z.string().describe(
      "The placeholder ID like 'PLACEHOLDER_ENTITY_1'",
    ),
    entityType: z.string().describe(
      "The entity type like 'schema:Person' or 'schema:Event'",
    ),
    entityName: z.string().describe(
      "The name of the entity extracted from the input",
    ),
    sourceText: z.string().describe(
      "The original text snippet from the input that led to this entity",
    ),
  })).describe("Array of entities extracted from the input text"),
});

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
): Promise<GenerateTurtleResult> {
  const maxRetries = context.maxRetries ?? 3;
  const allowedPrefixes = context.allowedPrefixes ?? defaultAllowedPrefixes;

  // Build prompt sections programmatically.

  // 1. Task context
  const taskContext =
    "You are an expert episodic memory extractor for RDF knowledge graphs. Your role is to convert natural language stream of consciousness into valid Turtle (TTL) using schema.org vocabulary to faithfully capture episodes (who/what/when/where). Generate Turtle with placeholder IDs using the format 'PLACEHOLDER_ENTITY_1', 'PLACEHOLDER_ENTITY_2', etc. that will be replaced with generated IDs afterward.";

  // 2. Tone context
  const toneContext =
    "Maintain precision and consistency. Be thorough in entity identification and relationship mapping. Follow RDF best practices strictly. CRITICAL: Only create triples that are directly evidenced by the user input - do not fabricate, infer, or add information not explicitly mentioned.";

  // 3. Background data
  const backgroundData =
    "You have access to schema.org vocabulary and SHACL validation shapes. Use placeholder IDs in the format 'PLACEHOLDER_ENTITY_1', 'PLACEHOLDER_ENTITY_2', etc. that will be replaced with generated IDs afterward.";

  // 5. Core requirements
  const coreRequirements = [
    "Core Requirements:",
    "EVIDENCE-BASED ONLY: Create triples ONLY for information explicitly mentioned in the user input. Do not infer, assume, or fabricate any properties, relationships, or entities not directly stated. Do not add temporal information (times, dates, durations) unless explicitly provided. Do not add status information (completed, pending, etc.) unless explicitly stated.",
    "PLACEHOLDER ENTITIES: Use placeholder IDs like 'PLACEHOLDER_ENTITY_1', 'PLACEHOLDER_ENTITY_2' for all entities that will be replaced with generated IDs afterward.",
    "NO HARDCODED IDs: Never use hardcoded IDs like 'meetup1', 'action1', 'event1', etc.",
    `Use only allowlisted prefixes: ${
      allowedPrefixes.join(", ")
    }. Expand to full IRIs instead of introducing new prefixes.`,
    "Prefer schema.org vocabulary for Actions, Events, CreativeWorks, and Places.",
    "Capture ONLY episode information explicitly mentioned: agent, object, location.",
    "Use typed literals with xsd (xsd:date, xsd:dateTime, xsd:decimal, xsd:duration).",
    "Prefer named HTTP(S) IRIs over blank nodes whenever possible.",
    "Reuse identical IRIs across triples; do not alias or paraphrase.",
    "DESCRIPTIVE CONTENT: For Actions and Events, include schema:name and schema:description predicates when the input provides descriptive information.",
  ];

  // 6. Examples and guidance
  const examplesGuidance = [
    "See the provided few-shot examples for proper Turtle structure and entity modeling patterns.",
    "DESCRIPTIVE EXAMPLE: For input 'I met up with Kyle at the Lost Bean cafe', the Action should include: schema:name 'Meet up with Kyle' and schema:description 'Meeting with Kyle at the Lost Bean cafe'.",
  ];

  // 7. Workflow steps
  const workflowSteps = [
    "EXECUTION WORKFLOW - DO THIS NOW:",
    "Identify entities from input text.",
    "Use placeholder IDs like 'PLACEHOLDER_ENTITY_1', 'PLACEHOLDER_ENTITY_2' for all entities.",
    "Generate Turtle with placeholder IDs.",
    "CRITICAL: Generate Turtle output immediately. Focus on creating valid structure with placeholder IDs.",
  ];

  // 8. Output formatting
  const outputFormatting =
    "Output contract: You must provide a structured JSON object with two fields: 'turtle' (the Turtle RDF content) and 'entities' (array of extracted entity information). The turtle field should contain valid Turtle with placeholder IDs. The entities field should contain an array of objects with placeholderId, entityType, entityName, and sourceText fields. Use placeholder IDs in the format 'PLACEHOLDER_ENTITY_1', 'PLACEHOLDER_ENTITY_2', etc. that will be replaced with generated IDs afterward.";

  // 9. Validation checklist
  const validationChecklist = [
    "Final validation checklist:",
    "PRIORITY: Identified entities from input text and used placeholder IDs for all.",
    "Followed ID resolution strategy: placeholder IDs for all entities.",
    "Mapped entities to placeholder IDs.",
    "Used placeholder IDs ONLY for entities with no existing ID found.",
    "Used only allowlisted prefixes.",
    "Included ONLY agent/object/location explicitly mentioned in input (no inferred time/status).",
    "Added descriptive content (schema:name, schema:description) for Actions and Events.",
    "Used typed literals with xsd.",
    "No hardcoded IDs.",
    "Used language tag 'en' for all English literals.",
    "No blank nodes.",
    "Ensured Turtle parses correctly.",
  ];

  // Combine all sections.
  const systemPrompt = [
    taskContext,
    toneContext,
    backgroundData,
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
    if (context.verbose) {
      console.log(`Attempt ${attempt}/${maxRetries} generating Turtle...`);
    }

    const result = await generateObject({
      model,
      temperature: context.temperature ?? 0.1,
      system: systemPrompt,
      messages,
      schema: GenerateTurtleSchema,
      schemaName: "TurtleWithEntities",
      schemaDescription:
        "Generated Turtle RDF content with extracted entity information",
    });

    if (context.verbose) {
      console.log(`📝 Generated Turtle length: ${result.object.turtle.length}`);
      console.log(`📝 Generated Turtle:\n${result.object.turtle}`);
      console.log(`🔍 Extracted ${result.object.entities.length} entities:`);
      result.object.entities.forEach((entity, index) => {
        console.log(
          `  ${
            index + 1
          }. ${entity.placeholderId}: ${entity.entityName} (${entity.entityType}) from "${entity.sourceText}"`,
        );
      });
    }

    const trimmed = trimFence(result.object.turtle.trim());

    // Check if the sanitized text is empty
    if (!trimmed || trimmed.trim().length === 0) {
      const feedback = [
        "The previous output was empty or contained no valid Turtle content.",
        "You must generate actual Turtle triples using placeholder IDs in the format 'PLACEHOLDER_ENTITY_1', 'PLACEHOLDER_ENTITY_2', etc. that will be replaced with generated IDs afterward.",
        "Please output valid Turtle with proper triples using placeholder IDs in the format 'PLACEHOLDER_ENTITY_1', 'PLACEHOLDER_ENTITY_2', etc.",
      ].join("\n\n");
      if (context.verbose) {
        console.log("Empty output feedback:", feedback);
      }

      // Add the response messages to conversation history for multi-step calls.
      messages.push({
        role: "assistant",
        content: JSON.stringify(result.object),
      });
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
      if (context.verbose) {
        console.log("Validation feedback:", feedback);
      }

      // Add the response messages to conversation history for multi-step calls.
      messages.push({
        role: "assistant",
        content: JSON.stringify(result.object),
      });
      messages.push({ role: "user", content: feedback });
      continue;
    }

    if (context.verbose) {
      console.log(
        `🎉 Success! Generated valid Turtle with ${result.object.entities.length} entities`,
      );
    }
    return result.object;
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
