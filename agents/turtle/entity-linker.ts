import type { LinkedEntity } from "agents/linker/entity-linker.ts";
import { extractPlaceholderIds } from "./placeholder-replacer.ts";

interface ExtractedEntity {
  placeholderId: string;
  entityType: string;
  entityName: string;
}

/**
 * Extracts entity information from Turtle content with placeholders.
 *
 * @param turtleContent - The Turtle content containing placeholders
 * @returns Array of entity information extracted from the Turtle
 */
export function extractEntitiesFromTurtle(
  turtleContent: string,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  const placeholderIds = extractPlaceholderIds(turtleContent);

  for (const placeholderId of placeholderIds) {
    // Extract entity type and name from the Turtle content
    // Look for patterns like: <PLACEHOLDER_ENTITY_1> a schema:Person .
    const entityPattern = new RegExp(
      `<${placeholderId}>\\s+a\\s+([^\\s;]+)`,
      "g",
    );

    const match = entityPattern.exec(turtleContent);
    if (match) {
      const entityType = match[1].replace("schema:", "https://schema.org/");

      // Try to extract entity name from schema:name property
      // Look for the pattern within the entity block (until the next entity or end)
      const entityBlockPattern = new RegExp(
        `<${placeholderId}>[\\s\\S]*?(?=\\n\\n<PLACEHOLDER_ENTITY_|\\n\\n$|$)`,
        "g",
      );

      const entityBlockMatch = entityBlockPattern.exec(turtleContent);
      let entityName = `Entity ${placeholderId}`;

      if (entityBlockMatch) {
        const namePattern = /schema:name\s+"([^"]+)"/;
        const nameMatch = entityBlockMatch[0].match(namePattern);
        if (nameMatch) {
          entityName = nameMatch[1];
        }
      }

      entities.push({
        placeholderId,
        entityType,
        entityName,
      });
    }
  }

  return entities;
}

/**
 * Creates a mapping from placeholder IDs to final IDs based on linked entities.
 */
export function createPlaceholderMapping(
  turtleContent: string,
  linkedEntities: LinkedEntity[],
): Map<string, string> {
  const mapping = new Map<string, string>();
  const extractedEntities = extractEntitiesFromTurtle(turtleContent);

  for (const entity of extractedEntities) {
    const linkedEntity = linkedEntities.find((le) =>
      le.entity.text.toLowerCase() === entity.entityName.toLowerCase()
    );

    if (linkedEntity?.hit) {
      mapping.set(entity.placeholderId, linkedEntity.hit.subject);
    } else {
      const generatedId = genid(crypto.randomUUID());
      mapping.set(entity.placeholderId, generatedId);
    }
  }

  return mapping;
}

export function genid(id: string): string {
  return `https://fartlabs.org/.well-known/genid/${id}`;
}
