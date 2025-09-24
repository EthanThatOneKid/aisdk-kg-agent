import { tool } from "ai";
import { z } from "zod";

export interface GenerateIdToolConfig {
  generate: () => string;
  verbose?: boolean;
}

export function generateIdTool(config: GenerateIdToolConfig) {
  const { generate, verbose = true } = config;

  // Track generated IDs to ensure consistency
  const generatedIds = new Map<string, string>();
  return tool({
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
      const normalizedName = entityName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const key = `${normalizedName}-${entityType}`;
      if (!generatedIds.has(key)) {
        const id = generate();
        generatedIds.set(key, id);
        if (verbose) {
          console.log(
            `✅ generateId tool: Generated new ID for ${entityName} (${entityType}) -> ${id}`,
          );
        }
      } else {
        const existingId = generatedIds.get(key)!;
        if (verbose) {
          console.log(
            `🔄 generateId tool: Reusing existing ID for ${entityName} (${entityType}) -> ${existingId}`,
          );
        }
      }

      return generatedIds.get(key)!;
    },
  });
}
