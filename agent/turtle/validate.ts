// This module validates Turtle syntax using the N3 parser.
// It exposes a single function `isValidTurtle` that returns either { ok: true }
// or { ok: false, error } based on parsing success.
import { Parser as N3Parser } from "n3";

export function isValidTurtle(
  turtle: string,
): { ok: true } | { ok: false; error: string } {
  try {
    const parser = new N3Parser();
    // The parse method throws on invalid Turtle.
    parser.parse(turtle);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
