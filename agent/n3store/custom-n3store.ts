// @deno-types="@types/n3"
import { Store } from "n3";
import type { Quad } from "@rdfjs/types";
import type { QuadInterceptor } from "./interceptor/interceptor.ts";

export class CustomN3Store extends Store {
  public constructor(private interceptors: QuadInterceptor[] = []) {
    super();
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
        // Continue with other interceptors even if one fails
      }
    });
  }

  public override addQuad(...args: Parameters<Store["addQuad"]>): boolean {
    const result = super.addQuad(...args);
    if (result) {
      // args[0] is the Quad parameter from the N3 Store addQuad method.
      const quad = args[0];
      this.notifyInterceptors("addQuad", quad);
    }
    return result;
  }

  public override removeQuad(
    ...args: Parameters<Store["removeQuad"]>
  ): boolean {
    const result = super.removeQuad(...args);
    if (result) {
      // args[0] is the Quad parameter from the N3 Store removeQuad method.
      const quad = args[0];
      this.notifyInterceptors("removeQuad", quad);
    }
    return result;
  }
}
