import { z } from "zod";
import type { DisambiguationService } from "./disambiguation/service.ts";
import type { NerEntity, NerService } from "./ner/service.ts";
import { nerEntitySchema } from "./ner/service.ts";
import type { SearchHit, SearchService } from "./search/service.ts";
import { searchHitSchema } from "./search/service.ts";

/**
 * LinkedEntity is an entity with an associated record from the knowledge graph.
 */
export type LinkedEntity = z.infer<typeof linkedEntitySchema>;

export const linkedEntitySchema = z.object({
  entity: nerEntitySchema,
  hit: searchHitSchema.nullable(),
});

/**
 * EntityLinker links entities to the knowledge graph.
 */
export class EntityLinker {
  constructor(
    private readonly ner: NerService,
    private readonly search: SearchService,
    private readonly disambiguation: DisambiguationService,
  ) {}

  async linkEntities(text: string): Promise<LinkedEntity[]> {
    const entities = await this.ner.recognize(text);
    return await Promise.all(entities.map(async (entity) => ({
      entity,
      hit: await this.linkEntity(entity),
    })));
  }

  async linkEntity(entity: NerEntity): Promise<SearchHit | null> {
    const response = await this.search.search(entity);
    if (response.hits.length === 0) {
      return null;
    }

    const hit = await this.disambiguation.disambiguate(response);
    return hit;
  }
}
