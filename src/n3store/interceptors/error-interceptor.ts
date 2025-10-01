import type { Quad } from "@rdfjs/types";
import type { QuadInterceptor } from "./interceptor.ts";

export class ErrorInterceptor implements QuadInterceptor {
  public errors: Array<{ method: string; error: Error; quad: Quad }> = [];

  public addQuad(quad: Quad): void {
    const error = new Error("ErrorInterceptor: addQuad failed");
    this.errors.push({ method: "addQuad", error, quad });
    throw error;
  }

  public removeQuad(quad: Quad): void {
    const error = new Error("ErrorInterceptor: removeQuad failed");
    this.errors.push({ method: "removeQuad", error, quad });
    throw error;
  }

  public getErrorCount(): number {
    return this.errors.length;
  }

  public getErrorsForMethod(
    method: string,
  ): Array<{ method: string; error: Error; quad: Quad }> {
    return this.errors.filter((e) => e.method === method);
  }

  public clearErrors(): void {
    this.errors = [];
  }
}
