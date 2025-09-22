import { z } from "zod";
import { validateSparql } from "./validate.ts";

// SPARQL schema with detailed error messages using check API
export const sparqlSchema = z.string().check((ctx) => {
  const result = validateSparql(ctx.value);

  if (!result.isValid) {
    // Add each validation error as a separate issue
    for (const error of result.errors) {
      ctx.issues.push({
        code: "custom",
        message: error,
        input: ctx.value,
        continue: true, // Allow multiple issues to be reported
      });
    }
  }
});
