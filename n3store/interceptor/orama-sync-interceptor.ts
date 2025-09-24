import type { Quad } from "@rdfjs/types";
import type { QuadInterceptor } from "./interceptor.ts";
import type {
  OramaTriple,
  OramaTripleStore,
} from "agents/ner/search/orama/search.ts";
import { insertTriple, removeTriple } from "agents/ner/search/orama/search.ts";

/**
 * OramaSyncInterceptor synchronizes N3 store changes with an Orama triple store
 * for search functionality. When quads are added to the N3 store, they are
 * automatically added to the Orama store for search indexing.
 */
export class OramaSyncInterceptor implements QuadInterceptor {
  constructor(private readonly oramaStore: OramaTripleStore) {}

  public async addQuad(quad: Quad): Promise<void> {
    try {
      // Convert N3 Quad to OramaTriple format.
      const triple: OramaTriple = {
        subject: quad.subject.value,
        predicate: quad.predicate.value,
        object: quad.object.value,
      };

      // Insert into Orama store for search indexing.
      await insertTriple(this.oramaStore, triple);
    } catch (error) {
      console.error(
        "OramaSyncInterceptor: Failed to sync quad to Orama store:",
        error,
      );
      // Don't throw - we want N3 operations to continue even if Orama sync fails.
    }
  }

  public async removeQuad(quad: Quad): Promise<void> {
    try {
      // Convert N3 Quad to OramaTriple format.
      const triple: OramaTriple = {
        subject: quad.subject.value,
        predicate: quad.predicate.value,
        object: quad.object.value,
      };

      // Remove from Orama store.
      await removeTriple(this.oramaStore, triple);
    } catch (error) {
      console.error(
        "OramaSyncInterceptor: Failed to remove quad from Orama store:",
        error,
      );
      // Don't throw - we want N3 operations to continue even if Orama sync fails.
    }
  }
}
