/**
 * Replaces placeholder IDs in Turtle content with provided IDs.
 *
 * This function finds all placeholder IDs in the format 'PLACEHOLDER_ENTITY_N'
 * and replaces them with the provided mapping.
 *
 * @param turtleContent - The Turtle content containing placeholder IDs
 * @param placeholderMapping - Map from placeholder IDs to final IDs
 * @returns string - The Turtle content with placeholder IDs replaced
 */
export function replacePlaceholderIds(
  turtleContent: string,
  placeholderMapping: Map<string, string>,
): string {
  // Find all placeholder IDs in the format PLACEHOLDER_ENTITY_N
  const placeholderRegex = /PLACEHOLDER_ENTITY_\d+/g;
  const placeholders = turtleContent.match(placeholderRegex);

  if (!placeholders) {
    // No placeholders found, return original content
    return turtleContent;
  }

  // Replace all placeholders with mapped IDs
  let result = turtleContent;
  for (const placeholder of placeholders) {
    const finalId = placeholderMapping.get(placeholder);
    if (finalId) {
      result = result.replace(new RegExp(placeholder, "g"), finalId);
    }
  }

  return result;
}

/**
 * Extracts placeholder IDs from Turtle content.
 *
 * @param turtleContent - The Turtle content to search
 * @returns string[] - Array of unique placeholder IDs found
 */
export function extractPlaceholderIds(turtleContent: string): string[] {
  const placeholderRegex = /PLACEHOLDER_ENTITY_\d+/g;
  const placeholders = turtleContent.match(placeholderRegex);
  return placeholders ? [...new Set(placeholders)] : [];
}

interface ExtractedEntity {
  placeholderId: string;
  entityType: string;
  entityName: string;
  sourceText: string;
}

interface LinkedEntity {
  entity: {
    text: string;
    offset: { index: number; start: number; length: number };
  };
  hit: {
    subject: string;
    score: number;
  } | null;
}

/**
 * Creates a mapping from placeholder IDs to final IDs based on linked entities.
 */
export function createPlaceholderMapping(
  extractedEntities: ExtractedEntity[],
  linkedEntities: LinkedEntity[],
): Map<string, string> {
  const mapping = new Map<string, string>();

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
