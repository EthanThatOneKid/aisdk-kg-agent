import type { Quad } from "@rdfjs/types";

/**
 * QuadInterceptor intercepts quads added and removed from a Store.
 */
export interface QuadInterceptor {
  addQuad: (quad: Quad) => void;
  removeQuad: (quad: Quad) => void;
}
