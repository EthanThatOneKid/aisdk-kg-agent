import { promptSelect } from "@std/cli/unstable-prompt-select";
import type { DisambiguationService } from "agents/linker/disambiguation/service.ts";
import type { SearchResponse } from "agents/linker/search/service.ts";

/**
 * PromptDisambiguationService prompts the user to disambiguate the candidate.
 */
export class PromptDisambiguationService implements DisambiguationService {
  // TODO: Add auto-confirm suggestions.
  public constructor(
    private readonly message = (text: string) => text,
  ) {}

  // TODO: Allow user to enter custom ID or generate a random one.

  public disambiguate(data: SearchResponse): Promise<string> {
    const selected = promptSelect(
      this.message(data.text),
      data.hits.map((hit, index) => ({
        label: `${hit.subject} (score: ${hit.score.toFixed(2)})`,
        value: index,
      })),
      { clear: true },
    );
    if (selected === null) {
      throw new Error("User cancelled disambiguation selection");
    }

    return Promise.resolve(data.hits[selected.value].subject);
  }
}
