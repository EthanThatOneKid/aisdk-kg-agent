import { promptSelect } from "@std/cli/unstable-prompt-select";
import type { DisambiguationService } from "agents/linker/disambiguation/service.ts";
import type { SearchResponse } from "agents/linker/search/service.ts";

/**
 * PromptDisambiguationService prompts the user to disambiguate the candidate.
 */
export class PromptDisambiguationService implements DisambiguationService {
  public constructor(private readonly random: () => string) {}

  public disambiguate(data: SearchResponse): Promise<string> {
    if (data.hits.length === 0) {
      return this.customize(data);
    }

    const selected = promptSelect(
      `'${data.text}' - Select the associated entity`,
      data.hits.map((hit, index) => ({
        label: `${hit.score.toFixed(2)} - <${hit.subject}>`,
        value: index,
      })),
    );
    if (selected === null) {
      return this.customize(data);
    }

    return Promise.resolve(data.hits[selected.value].subject);
  }

  /**
   * customize prompts the user to enter a custom ID or generate a random one.
   */
  public customize(data: SearchResponse): Promise<string> {
    const id = prompt(
      `'${data.text}' - Enter ID (leave blank to generate a random ID)`,
    );
    if (!id) {
      return Promise.resolve(this.random());
    }

    if (!URL.canParse(id)) {
      console.error("ID must be a valid IRI");
      return this.customize(data);
    }

    return Promise.resolve(id);
  }
}
