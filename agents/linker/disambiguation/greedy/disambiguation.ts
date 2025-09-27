import type { DisambiguationService } from "agents/linker/disambiguation/service.ts";
import type { SearchResponse } from "agents/linker/search/service.ts";

/**
 * GreedyDisambiguationService resolves the candidate with the highest score.
 */
export class GreedyDisambiguationService implements DisambiguationService {
  public constructor(private readonly random: () => string) {}

  public disambiguate(data: SearchResponse): Promise<string> {
    const hit = data.hits.at(0);
    if (hit === undefined) {
      return Promise.resolve(this.random());
    }

    return Promise.resolve(hit.subject);
  }
}
