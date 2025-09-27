import { z } from "zod";
import type { GeneratedTurtleVariable } from "agents/turtle/schema.ts";
import { generatedTurtleVariableSchema } from "agents/turtle/schema.ts";
import type { SearchService } from "./search/service.ts";
import type { Disambiguator } from "./disambiguator/disambiguator.ts";

/**
 * LinkedEntity is a link between an entity and an associated record from the knowledge graph.
 */
export type LinkedEntity = z.infer<typeof linkedEntitySchema>;

export const linkedEntitySchema = z.object({
  entity: generatedTurtleVariableSchema,
  subject: z.string(),
});

/**
 * EntityLinker links entities to the knowledge graph.
 */
export class EntityLinker {
  public constructor(
    private readonly search: SearchService,
    private readonly disambiguation: Disambiguator,
  ) {}

  public async linkEntities(
    entities: GeneratedTurtleVariable[],
  ): Promise<LinkedEntity[]> {
    return await Promise.all(entities.map(async (entity) => ({
      entity,
      subject: await this.linkEntity(entity),
    })));
  }

  public async linkEntity(
    entity: GeneratedTurtleVariable,
  ): Promise<string> {
    const response = await this.search.search(entity);
    return await this.disambiguation.disambiguate(response);
  }

  public static toMap(links: LinkedEntity[]): Map<string, string> {
    return new Map(
      links.map((link) => [link.entity.id, link.subject]),
    );
  }
}
