import * as n3 from "n3";
import { Validator as SHACLValidator } from "shacl-engine";

/**
 * ValidatorRequest is the input to the validator.
 */
export interface ValidatorRequest {
  /**
   * graphText contains the knowledge graph text to be validated.
   */
  graphText: string;

  /**
   * schemaText contains schema text that the knowledge graph must conform to.
   */
  schemaText?: string;
}

/**
 * ValidatorResponse is the output of the validator.
 */
export interface ValidatorResponse {
  /**
   * graphText contains the knowledge graph text that was validated.
   */
  graphText: string;

  /**
   * isValid indicates whether the knowledge graph is valid.
   */
  isValid: boolean;

  /**
   * errorText contains error messages that occurred during validation.
   */
  errorText: string | null;
}

/**
 * validateTurtle validates a knowledge graph based on a schema of SHACL
 * validation rules.
 */
export async function validateTurtle(
  request: ValidatorRequest,
): Promise<ValidatorResponse> {
  try {
    // Always parse the data to ensure syntax validity even without a schema.
    const data = parseTurtle(request.graphText);

    // If no schema provided, syntax-parse success implies valid.
    if (!request.schemaText) {
      return {
        isValid: true,
        graphText: request.graphText,
        errorText: null,
      };
    }

    const shapes = parseTurtle(request.schemaText);
    const validator = new SHACLValidator(shapes, { factory: n3.DataFactory });
    const report = await validator.validate({ dataset: data });
    const isValid = report.conforms;
    const errorText = !isValid
      ? await report.dataset.serialize({ format: "text/turtle" })
      : null;
    return {
      isValid,
      graphText: request.graphText,
      errorText,
    };
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    return {
      isValid: false,
      graphText: request.graphText,
      errorText,
    };
  }
}

/**
 * parseTurtle parses Turtle text and stores the triples in a n3.Store.
 */
export function parseTurtle(turtleText: string): n3.Store {
  const parser = new n3.Parser({ format: "text/turtle" });
  const quads = parser.parse(turtleText);
  const store = new n3.Store();
  store.addQuads(quads);
  return store;
}

/**
 * trimTurtle trims Turtle text to remove unnecessary prefixes and periods.
 */
export function trimTurtle(turtleText: string): string {
  let trimmed = turtleText
    .replace(/```(?:turtle|rdf|ttl)?\n?/g, "")
    .replace(/\n?```/g, "");

  const prefixIndex = trimmed.indexOf("@prefix");
  if (prefixIndex > 0) {
    trimmed = trimmed.substring(prefixIndex);
  }

  const lastPeriodIndex = trimmed.lastIndexOf(".");
  if (lastPeriodIndex > 0) {
    trimmed = trimmed.substring(0, lastPeriodIndex + 1);
  }

  trimmed = trimmed.trim();
  if (!trimmed.startsWith("@prefix")) {
    return "ERROR: INVALID_TURTLE_FORMAT: Missing @prefix declarations";
  }

  if (!trimmed.endsWith(".")) {
    return "ERROR: INVALID_TURTLE_FORMAT: Missing terminating period";
  }

  return trimmed;
}
