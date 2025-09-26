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

  async linkExtractedEntities(
    extractedEntities: Array<{
      placeholderId: string;
      entityType: string;
      entityName: string;
    }>,
  ): Promise<LinkedEntity[]> {
    return await Promise.all(extractedEntities.map(async (extractedEntity) => {
      // Create a NerEntity from the extracted entity
      const nerEntity: NerEntity = {
        text: extractedEntity.entityName,
        offset: {
          index: 0, // Not relevant for extracted entities
          start: 0, // Not relevant for extracted entities
          length: extractedEntity.entityName.length, // Not relevant for extracted entities
        },
      };

      return {
        entity: nerEntity,
        hit: await this.linkEntity(nerEntity),
      };
    }));
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
