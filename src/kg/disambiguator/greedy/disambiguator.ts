import type { Disambiguator } from "src/kg/disambiguator/disambiguator.ts";
import type { SearchResponse } from "src/search/search.ts";

/**
 * GreedyDisambiguator resolves the candidate with the highest score.
 */
export class GreedyDisambiguator implements Disambiguator {
  public constructor(private readonly random?: () => string) {}

  public disambiguate(data: SearchResponse): Promise<string> {
    const hit = data.hits.at(0);
    if (hit === undefined) {
      if (this.random === undefined) {
        throw new Error("No search hits available for disambiguation");
      }

      return Promise.resolve(this.random());
    }

    return Promise.resolve(hit.subject);
  }
}
