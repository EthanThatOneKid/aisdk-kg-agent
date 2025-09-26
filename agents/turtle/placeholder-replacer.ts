/**
 * Replaces placeholder IDs in Turtle content with generated IDs.
 *
 * This function finds all placeholder IDs in the format 'PLACEHOLDER_ENTITY_N'
 * and replaces them with unique generated IDs.
 *
 * @param turtleContent - The Turtle content containing placeholder IDs
 * @param baseUrl - The base URL for generating IDs (defaults to fartlabs.org)
 * @returns Promise<string> - The Turtle content with placeholder IDs replaced
 */
export async function replacePlaceholderIds(
  turtleContent: string,
  baseUrl: string = "https://fartlabs.org/.well-known/genid",
): Promise<string> {
  // Find all placeholder IDs in the format PLACEHOLDER_ENTITY_N
  const placeholderRegex = /PLACEHOLDER_ENTITY_\d+/g;
  const placeholders = turtleContent.match(placeholderRegex);

  if (!placeholders) {
    // No placeholders found, return original content
    return turtleContent;
  }

  // Get unique placeholders (in case of duplicates)
  const uniquePlaceholders = [...new Set(placeholders)];

  // Generate IDs for each unique placeholder
  const replacements = new Map<string, string>();

  for (const placeholder of uniquePlaceholders) {
    try {
      // Generate a unique ID for this placeholder
      const generatedId = `${baseUrl}/${crypto.randomUUID()}`;
      replacements.set(placeholder, generatedId);
    } catch (error) {
      console.warn(
        `Failed to generate ID for placeholder ${placeholder}:`,
        error,
      );
      // Keep the original placeholder if generation fails
      replacements.set(placeholder, placeholder);
    }
  }

  // Replace all placeholders with generated IDs
  let result = turtleContent;
  for (const [placeholder, generatedId] of replacements) {
    result = result.replace(new RegExp(placeholder, "g"), generatedId);
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

/**
 * Checks if Turtle content contains placeholder IDs.
 *
 * @param turtleContent - The Turtle content to check
 * @returns boolean - True if placeholders are found, false otherwise
 */
export function hasPlaceholderIds(turtleContent: string): boolean {
  return extractPlaceholderIds(turtleContent).length > 0;
}
