import { default as nlp } from "compromise";
import { default as pluginDates } from "compromise-dates";
import type { NerEntity, NerInterface } from "./ner-interface.ts";

nlp.extend(pluginDates);

export class CompromiseService implements NerInterface {
  public recognize(text: string): Promise<NerEntity[]> {
    const doc = nlp(text);
    const entities: NerEntity[] = [];
    entities.push(
      ...fromCompromise(doc.people().json({ offset: true, unique: true })),
    );

    entities.push(
      ...fromCompromise(
        doc.organizations().json({ offset: true, unique: true }),
      ),
    );

    entities.push(
      ...fromCompromise(doc.places().json({ offset: true, unique: true })),
    );

    entities.push(
      ...fromCompromise(doc.nouns().json({ offset: true, unique: true })),
    );

    entities.push(
      ...fromCompromise(
        // deno-lint-ignore no-explicit-any
        (doc as any).dates().json({ offset: true, unique: true }),
      ),
    );

    return Promise.resolve(
      entities.toSorted((a, b) => a.offset.start - b.offset.start),
    );
  }
}

/**
 * fromCompromise converts Compromise captures to NerEntity objects.
 */
// deno-lint-ignore no-explicit-any
function fromCompromise(captures: any[]): NerEntity[] {
  return captures.map((capture) => ({
    text: capture.text,
    offset: capture.offset,
  }));
}
