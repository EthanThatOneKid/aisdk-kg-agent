import { assertEquals, assertExists } from "@std/assert";
import type { OramaTriple, OramaTripleStore } from "src/orama/triple-store.ts";
import {
  createOramaTripleStore,
  findTriple,
  insertTriple,
} from "src/orama/triple-store.ts";
import {
  createDenoKvPersistedOramaTripleStore,
  getOramaFromKv,
  getOramaJsonFromKv,
  removeOramaFromKv,
  setOramaToKv,
} from "./kv.ts";

Deno.test(
  "createDenoKvPersistedOramaTripleStore - basic functionality",
  async () => {
    const kv = await Deno.openKv(":memory:");
    const key: Deno.KvKey = ["test", "orama", "store"];

    try {
      const { orama, persist } = await createDenoKvPersistedOramaTripleStore(
        kv,
        key,
      );

      const triple: OramaTriple = {
        subject: "http://example.org/person1",
        predicate: "http://schema.org/name",
        object: "Alice",
      };

      await insertTriple(orama, triple);
      await persist();

      const { orama: loaded } = await createDenoKvPersistedOramaTripleStore(
        kv,
        key,
      );

      const id = await findTriple(loaded, triple);
      assertExists(id);
    } finally {
      await removeOramaFromKv(kv, key);
      kv.close();
    }
  },
);

Deno.test(
  "createDenoKvPersistedOramaTripleStore - with expiration",
  async () => {
    const kv = await Deno.openKv(":memory:");
    const key: Deno.KvKey = ["test", "orama", "expire"];

    try {
      const { orama, persist } = await createDenoKvPersistedOramaTripleStore(
        kv,
        key,
        { expireIn: 1000 },
      );

      const triple: OramaTriple = {
        subject: "http://example.org/person1",
        predicate: "http://schema.org/name",
        object: "Alice",
      };

      await insertTriple(orama, triple);
      await persist();

      const { orama: loaded } = await createDenoKvPersistedOramaTripleStore(
        kv,
        key,
      );

      const id = await findTriple(loaded, triple);
      assertExists(id);
    } finally {
      await removeOramaFromKv(kv, key);
      kv.close();
    }
  },
);

Deno.test("removeOramaFromKv - removes data", async () => {
  const kv = await Deno.openKv(":memory:");
  const key: Deno.KvKey = ["test", "orama", "remove"];

  try {
    const { orama, persist } = await createDenoKvPersistedOramaTripleStore(
      kv,
      key,
    );

    const triple: OramaTriple = {
      subject: "http://example.org/person1",
      predicate: "http://schema.org/name",
      object: "Alice",
    };
    await insertTriple(orama, triple);
    await persist();

    const { orama: loaded } = await createDenoKvPersistedOramaTripleStore(
      kv,
      key,
    );
    assertExists(await findTriple(loaded, triple));

    await removeOramaFromKv(kv, key);

    const restored = await getOramaFromKv(kv, key);
    assertEquals(restored, null);

    const { orama: empty } = await createDenoKvPersistedOramaTripleStore(
      kv,
      key,
    );
    const missing = await findTriple(empty, triple);
    assertEquals(missing, null);
  } finally {
    kv.close();
  }
});

Deno.test(
  "setOramaToKv and getOramaFromKv - direct operations",
  async () => {
    const kv = await Deno.openKv(":memory:");
    const key: Deno.KvKey = ["test", "orama", "direct"];

    try {
      const orama: OramaTripleStore = await createOramaTripleStore();
      const triple: OramaTriple = {
        subject: "http://example.org/person2",
        predicate: "http://schema.org/name",
        object: "Bob",
      };
      await insertTriple(orama, triple);

      await setOramaToKv(kv, key, orama);

      const loaded = await getOramaFromKv(kv, key);
      assertExists(loaded);
      assertExists(await findTriple(loaded!, triple));
    } finally {
      await removeOramaFromKv(kv, key);
      kv.close();
    }
  },
);

Deno.test(
  "getOramaJsonFromKv - returns null for non-existent key",
  async () => {
    const kv = await Deno.openKv(":memory:");
    const key: Deno.KvKey = ["non", "existent", "orama"];

    try {
      const json = await getOramaJsonFromKv(kv, key);
      assertEquals(json, null);
    } finally {
      kv.close();
    }
  },
);

Deno.test(
  "kv-toolbox blob integration - large data handling",
  async () => {
    const kv = await Deno.openKv(":memory:");
    const key: Deno.KvKey = ["test", "orama", "large"];

    try {
      const orama: OramaTripleStore = await createOramaTripleStore();

      for (let i = 0; i < 10; i++) {
        const triple: OramaTriple = {
          subject: `http://example.org/person${i}`,
          predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
          object: "http://schema.org/Person",
        };
        await insertTriple(orama, triple);
      }

      await setOramaToKv(kv, key, orama);

      const loaded = await getOramaFromKv(kv, key);
      assertExists(loaded);

      for (let i = 0; i < 10; i++) {
        const triple: OramaTriple = {
          subject: `http://example.org/person${i}`,
          predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
          object: "http://schema.org/Person",
        };
        const id = await findTriple(loaded!, triple);
        assertExists(id);
      }
    } finally {
      await removeOramaFromKv(kv, key);
      kv.close();
    }
  },
);
