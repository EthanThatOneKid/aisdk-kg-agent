import * as n3 from "n3";
import { Validator as SHACLValidator } from "shacl-engine";
import { insertTurtle } from "src/n3store/turtle.ts";

/**
 * validateTurtle validates a knowledge graph based on a schema of SHACL
 * validation rules.
 */
export async function validateTurtle(
  turtleText: string,
  shapesText?: string,
): Promise<string | null> {
  try {
    // Always parse the data to ensure syntax validity even without a schema.
    const data = new n3.Store();
    insertTurtle(data, turtleText);

    // If no schema provided, syntax-parse success implies valid.
    if (!shapesText) {
      return null;
    }

    const shapes = new n3.Store();
    insertTurtle(shapes, shapesText);

    // Validate the data against the shapes.
    const validator = new SHACLValidator(shapes, { factory: n3.DataFactory });
    const report = await validator.validate({ dataset: data });
    const isValid = report.conforms;

    if (!isValid) {
      // Return the SHACL validation report directly as JSON.
      return JSON.stringify({
        conforms: report.conforms,
        results: report.results,
      });
    }

    return null;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }

    throw error;
  }
}
