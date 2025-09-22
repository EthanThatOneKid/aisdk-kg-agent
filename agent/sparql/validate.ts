import { translate } from "sparqlalgebrajs";
import { isExpressionError } from "@comunica/utils-expression-evaluator";

export interface SparqlValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a SPARQL query by parsing it and checking for errors.
 *
 * @param sparqlQuery - The SPARQL query string to validate
 * @returns SparqlValidationResult - Validation result with errors
 */
export function validateSparql(sparqlQuery: string): SparqlValidationResult {
  const errors: string[] = [];

  // Check for empty query.
  if (!sparqlQuery || sparqlQuery.trim().length === 0) {
    errors.push("Empty SPARQL query");
    return {
      isValid: false,
      errors,
    };
  }

  try {
    // Parse the SPARQL query to SPARQL Algebra.
    const query = translate(sparqlQuery);

    // If parsing succeeds without throwing an error, the query is valid.
    if (!query) {
      errors.push("Invalid SPARQL query: unable to parse");
    }
  } catch (error) {
    if (error instanceof Error && isExpressionError(error)) {
      errors.push(`SPARQL expression error: ${error.message}`);
    } else {
      errors.push(
        `SPARQL parsing error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
