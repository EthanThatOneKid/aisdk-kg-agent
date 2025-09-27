import type { EntityLinker } from "agents/linker/entity-linker.ts";
import type { GenerateTurtleOptions } from "./generate.ts";
import { generateTurtle } from "./generate.ts";

export class TurtleGenerator {
  public constructor(private readonly linker: EntityLinker) {}

  public async generate(options: GenerateTurtleOptions): Promise<string> {
    const result = await generateTurtle(options);
    // TODO: Perform entity linking on the extracted entities.

    return result.turtle;
  }
}
