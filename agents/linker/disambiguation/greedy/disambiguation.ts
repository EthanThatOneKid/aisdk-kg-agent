import type { DisambiguationService } from "agents/linker/disambiguation/service.ts";
import type { SearchResponse } from "agents/linker/search/service.ts";

/**
 * GreedyDisambiguationService resolves the candidate with the highest score.
 */
export class GreedyDisambiguationService implements DisambiguationService {
  public disambiguate(data: SearchResponse): Promise<string> {
    const hit = data.hits.at(0);
    if (hit === undefined) {
      throw new Error("No search hits available for disambiguation");
    }

    return Promise.resolve(hit.subject);
  }
}
