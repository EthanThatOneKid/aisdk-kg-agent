import { Parser } from "n3";

export function validateTurtle(
  turtle: string,
): { ok: boolean; error?: string } {
  const parser = new Parser();
  try {
    parser.parse(turtle);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
