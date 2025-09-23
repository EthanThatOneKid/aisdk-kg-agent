import { create, insert, remove, search } from "@orama/orama";
import type { SearchResult, SearchService } from "agents/ner/search/search.ts";

export class OramaSearchService implements SearchService {
  constructor(private readonly orama: OramaTripleStore) {}

  async search(query: string): Promise<SearchResult[]> {
    const result = await search(this.orama, {
      term: query,
      properties: ["object"],
    });
    const subjects = result.hits
      .map((hit) => ({ subject: hit.document.subject, score: hit.score }))
      .reduce((acc, cur) => {
        acc.set(cur.subject, (acc.get(cur.subject) ?? 0) + cur.score);
        return acc;
      }, new Map<string, number>());
    return Array.from(subjects.entries())
      .toSorted((a, b) => b[1] - a[1])
      .map(([subject, score]) => ({ subject, score }));
  }
}

export type OramaTripleStore = ReturnType<typeof createOramaTripleStore>;

export interface OramaTriple {
  subject: string;
  predicate: string;
  object: string;
}

export function createOramaTripleStore() {
  return create({
    schema: {
      subject: "string",
      predicate: "string",
      object: "string",
    },
  });
}

export async function insertTriple(
  orama: OramaTripleStore,
  triple: OramaTriple,
): Promise<string> {
  return await insert(orama, {
    subject: triple.subject,
    predicate: triple.predicate,
    object: triple.object,
  });
}

export async function removeTriple(
  orama: OramaTripleStore,
  triple: OramaTriple,
): Promise<string | null> {
  const foundId = await findTriple(orama, triple);
  if (!foundId) {
    return null;
  }

  await remove(orama, foundId);
  return foundId;
}

export async function findTriple(
  orama: OramaTripleStore,
  triple: OramaTriple,
): Promise<string | null> {
  const [s, p, o] = await Promise.all([
    search(orama, {
      term: triple.subject,
      properties: ["subject"],
      exact: true,
    }),
    search(orama, {
      term: triple.predicate,
      properties: ["predicate"],
      exact: true,
    }),
    search(orama, {
      term: triple.object,
      properties: ["object"],
      exact: true,
    }),
  ]);
  const setS = new Set();
  const setP = new Set();
  const setO = new Set();

  let i = 0;
  while (i < Math.max(s.hits.length, p.hits.length, o.hits.length)) {
    if (i < s.hits.length) {
      setS.add(s.hits[i].id);
      if (setP.has(s.hits[i].id) && setO.has(s.hits[i].id)) {
        return s.hits[i].id;
      }
    }

    if (i < p.hits.length) {
      setP.add(p.hits[i].id);
      if (setS.has(p.hits[i].id) && setO.has(p.hits[i].id)) {
        return p.hits[i].id;
      }
    }

    if (i < o.hits.length) {
      setO.add(o.hits[i].id);
      if (setS.has(o.hits[i].id) && setP.has(o.hits[i].id)) {
        return o.hits[i].id;
      }
    }

    i++;
  }

  return null;
}
