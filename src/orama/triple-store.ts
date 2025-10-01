import { create, insert, remove, search } from "@orama/orama";

/**
 * OramaTriple is a triple in the Orama triple store.
 */
export interface OramaTriple {
  subject: string;
  predicate: string;
  object: string;
}

/**
 * OramaTripleStore is an Orama triple store for RDF triples.
 */
export type OramaTripleStore = ReturnType<typeof createOramaTripleStore>;

/**
 * createOramaTripleStore creates an Orama triple store.
 */
export function createOramaTripleStore() {
  return create({
    schema: {
      subject: "string",
      predicate: "string",
      object: "string",
    },
  });
}

/**
 * insertTriple inserts a triple into an Orama triple store.
 */
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

/**
 * removeTriple removes a triple from an Orama triple store.
 */
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

/**
 * findTriple finds a triple in an Orama triple store.
 */
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
