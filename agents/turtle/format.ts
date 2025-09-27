/**
 * turtleVariablePattern is the pattern for placeholder entity IDs.
 */
const turtleVariablePattern = /\<PLACEHOLDER_ENTITY_\d+\>/g;

/**
 * substituteVariables substitutes the placeholder IDs with the generated IDs.
 */
export function substituteVariables(
  turtle: string,
  values: Map<string, string>,
): string {
  return turtle.replaceAll(
    turtleVariablePattern,
    (placeholder) => {
      const value = values.get(placeholder);
      if (value === undefined) {
        throw new Error(`Variable ${placeholder} not found`);
      }

      return `<${value}>`;
    },
  );
}

/**
 * fenceOpenPattern is the pattern for opening code fence blocks.
 */
const fenceOpenPattern = /^```[a-zA-Z]*\n/gm;

/**
 * fenceClosePattern is the pattern for closing code fence blocks.
 */
const fenceClosePattern = /```$/gm;

/**
 * trimFence trims the fence from the source code.
 */
export function trimFence(text: string): string {
  return text
    .replace(fenceOpenPattern, "")
    .replace(fenceClosePattern, "")
    .trim();
}
