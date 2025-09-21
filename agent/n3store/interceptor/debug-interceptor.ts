import type { Quad } from "@rdfjs/types";
import type { QuadInterceptor } from "./interceptor.ts";

export class DebugInterceptor implements QuadInterceptor {
  public addQuad(quad: Quad): void {
    console.log("addQuad", quad);
  }

  public removeQuad(quad: Quad): void {
    console.log("removeQuad", quad);
  }
}
