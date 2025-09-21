import type { Quad } from "@rdfjs/types";
import type { QuadInterceptor } from "./interceptor.ts";

export class CountInterceptor implements QuadInterceptor {
  public added = 0;
  public removed = 0;

  public addQuad(_quad: Quad): void {
    this.added++;
  }

  public removeQuad(_quad: Quad): void {
    this.removed++;
  }
}
