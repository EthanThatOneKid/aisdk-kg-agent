import type { Store } from "n3";
import { Parser, Writer } from "n3";

export function insertTurtle(store: Store, turtle: string): void {
  const parser = new Parser();
  const quads = parser.parse(turtle);
  for (const quad of quads) {
    store.addQuad(quad);
  }
}

export function exportTurtle(store: Store): Promise<string> {
  const writer = new Writer({ format: "text/turtle" });

  // Add all quads to the writer.
  for (const quad of store) {
    writer.addQuad(quad);
  }

  // Use the proper N3.js Writer API with Promise.
  return new Promise((resolve, reject) => {
    writer.end((error: Error | null, result: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(result ?? "");
      }
    });
  });
}
