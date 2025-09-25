import { promptSelect } from "@std/cli/unstable-prompt-select";
import type { DisambiguationService } from "agents/linker/disambiguation/service.ts";
import type {
  SearchHit,
  SearchResponse,
} from "agents/linker/search/service.ts";

/**
 * PromptDisambiguationService prompts the user to disambiguate the candidate.
 */
export class PromptDisambiguationService implements DisambiguationService {
  // TODO: Add auto-confirm suggestions.
  constructor(
    private readonly message = (text: string) =>
      `Please select the associated candidate: ${text}`,
  ) {}

  disambiguate(data: SearchResponse): Promise<SearchHit | null> {
    const selected = promptSelect(
      this.message(data.text),
      data.hits.map((hit, index) => ({
        label: `${hit.subject} (score: ${hit.score.toFixed(2)})`,
        value: index,
      })),
      { clear: true },
    );
    if (selected === null) {
      return Promise.resolve(null);
    }

    return Promise.resolve(data.hits[selected.value]);
  }
}
