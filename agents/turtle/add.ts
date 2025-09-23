import type { Store } from "n3";
import { Parser } from "n3";

export function addTurtle(store: Store, turtle: string): void {
  const parser = new Parser();
  const quads = parser.parse(turtle);
  for (const q of quads) {
    store.addQuad(q);
  }
}
