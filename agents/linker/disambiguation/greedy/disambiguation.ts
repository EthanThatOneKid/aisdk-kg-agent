import type { DisambiguationService } from "agents/linker/disambiguation/service.ts";
import type {
  SearchHit,
  SearchResponse,
} from "agents/linker/search/service.ts";

/**
 * GreedyDisambiguationService resolves the candidate with the highest score.
 */
export class GreedyDisambiguationService implements DisambiguationService {
  disambiguate(data: SearchResponse): Promise<SearchHit | null> {
    const hit = data.hits.at(0);
    if (hit === undefined) {
      return Promise.resolve(null);
    }

    return Promise.resolve(hit);
  }
}
