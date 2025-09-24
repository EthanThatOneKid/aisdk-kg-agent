import { Store } from "n3";
import type { DatasetCore, Quad, Term } from "@rdfjs/types";
import type { QuadInterceptor } from "./interceptor/interceptor.ts";
import { insertTurtle } from "agents/turtle/insert.ts";

export class CustomN3Store extends Store {
  public constructor(private interceptors: QuadInterceptor[] = []) {
    super();
  }

  // Ensure size property is accessible
  public get size(): number {
    return super.size;
  }

  // Add missing DatasetCore methods for SPARQL compatibility
  public add(quad: Quad): this {
    this.addQuad(quad);
    return this;
  }

  public delete(quad: Quad): this {
    this.removeQuad(quad);
    return this;
  }

  public has(quad: Quad): boolean {
    return super.has(quad);
  }

  public match(
    subject?: Term | null,
    predicate?: Term | null,
    object?: Term | null,
    graph?: Term | null,
  ): DatasetCore<Quad, Quad> {
    // Create a new dataset with the matching quads
    const dataset = new Store();
    for (const quad of super.match(subject, predicate, object, graph)) {
      dataset.add(quad);
    }
    return dataset;
  }

  public [Symbol.iterator](): IterableIterator<Quad> {
    return super[Symbol.iterator]();
  }

  public addInterceptor(interceptor: QuadInterceptor): void {
    this.interceptors.push(interceptor);
  }

  public removeInterceptor(interceptor: QuadInterceptor): void {
    const index = this.interceptors.indexOf(interceptor);
    if (index > -1) {
      this.interceptors.splice(index, 1);
    }
  }

  private notifyInterceptors(
    method: "addQuad" | "removeQuad",
    quad: Quad,
  ): void {
    this.interceptors.forEach((interceptor, index) => {
      try {
        interceptor[method](quad);
      } catch (error) {
        console.error(
          `Error in interceptor ${index} during ${method}:`,
          error,
          "Quad:",
          quad,
        );
        // Continue with other interceptors even if one fails...
      }
    });
  }

  public addQuad(...args: Parameters<Store["addQuad"]>): boolean {
    const result = super.addQuad(...args);
    if (result) {
      // args[0] is the Quad parameter from the N3 Store addQuad method.
      const quad = args[0] as Quad;
      this.notifyInterceptors("addQuad", quad);
    }

    return result;
  }

  public removeQuad(
    ...args: Parameters<Store["removeQuad"]>
  ): boolean {
    const result = super.removeQuad(...args);
    if (result) {
      // args[0] is the Quad parameter from the N3 Store removeQuad method.
      const quad = args[0] as Quad;
      this.notifyInterceptors("removeQuad", quad);
    }

    return result;
  }
}

export async function createManagedN3Store(filePath: string) {
  const store = new CustomN3Store();
  try {
    const data = await Deno.readTextFile(filePath);
    await insertTurtle(store, data);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log("No existing db.ttl found, starting with fresh data");
    } else {
      throw error;
    }
  }

  return {
    store,
    persist: async () => {
      await Deno.writeTextFile(filePath, store.toString());
    },
  };
}
