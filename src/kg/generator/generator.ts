import { EntityLinker } from "../linker/entity-linker.ts";
import type { GenerateTurtleOptions } from "./generate.ts";
import { generateTurtle } from "./generate.ts";
import { substituteVariables } from "./format.ts";

export class TurtleGenerator {
  public constructor(private readonly linker: EntityLinker) {}

  /**
   * generate generates valid Turtle RDF content linked to a knowledge graph.
   */
  public async generate(options: GenerateTurtleOptions): Promise<string> {
    const generated = await generateTurtle(options);
    const links = await this.linker.linkEntities(generated.variables);
    return substituteVariables(generated.turtle, EntityLinker.toMap(links));
  }
}
