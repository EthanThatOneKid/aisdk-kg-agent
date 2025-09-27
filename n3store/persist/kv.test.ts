import { assertEquals, assertExists } from "@std/assert";
import { DataFactory } from "n3";
import { CustomN3Store } from "n3store/custom-n3store.ts";
import {
  createDenoKvPersistedN3Store,
  getN3StoreFromKv,
  removeN3StoreFromKv,
  setN3StoreToKv,
} from "./kv.ts";

Deno.test("createDenoKvPersistedN3Store - basic functionality", async () => {
  // Create a temporary KV store for testing purposes.
  const kv = await Deno.openKv(":memory:");
  const key = ["test", "n3store"];

  try {
    // Create a persisted N3Store instance.
    const { n3Store, persist } = await createDenoKvPersistedN3Store(kv, key);

    // Add some test data to verify functionality.
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      DataFactory.namedNode("http://schema.org/Person"),
      DataFactory.defaultGraph(),
    );

    n3Store.addQuad(quad);
    assertEquals(n3Store.size, 1);

    // Persist the data to the KV store.
    await persist();

    // Create a new store and load from KV to verify persistence.
    const { n3Store: loadedStore } = await createDenoKvPersistedN3Store(
      kv,
      key,
    );

    // Verify the data was loaded correctly.
    assertEquals(loadedStore.size, 1);
    assertExists(loadedStore.has(quad));
  } finally {
    // Clean up test data and close the KV store.
    await removeN3StoreFromKv(kv, key);
    kv.close();
  }
});

Deno.test("createDenoKvPersistedN3Store - with expiration", async () => {
  const kv = await Deno.openKv(":memory:");
  const key = ["test", "n3store", "expire"];

  try {
    // Create a store with a one-second expiration time.
    const { n3Store, persist } = await createDenoKvPersistedN3Store(kv, key, {
      expireIn: 1000, // 1 second
    });

    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      DataFactory.namedNode("http://schema.org/Person"),
      DataFactory.defaultGraph(),
    );

    n3Store.addQuad(quad);
    await persist();

    // Verify data exists before expiration.
    const { n3Store: loadedStore } = await createDenoKvPersistedN3Store(
      kv,
      key,
    );
    assertEquals(loadedStore.size, 1);
  } finally {
    await removeN3StoreFromKv(kv, key);
    kv.close();
  }
});

Deno.test("removeN3StoreFromKv - removes data", async () => {
  const kv = await Deno.openKv(":memory:");
  const key = ["test", "n3store", "remove"];

  try {
    // Create and persist data to test deletion functionality.
    const { n3Store, persist } = await createDenoKvPersistedN3Store(kv, key);
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      DataFactory.namedNode("http://schema.org/Person"),
      DataFactory.defaultGraph(),
    );

    n3Store.addQuad(quad);
    await persist();

    // Verify data exists before deletion.
    const { n3Store: loadedStore } = await createDenoKvPersistedN3Store(
      kv,
      key,
    );
    assertEquals(loadedStore.size, 1);

    // Remove data using the remove function.
    await removeN3StoreFromKv(kv, key);

    // Verify data is completely gone after deletion.
    const { n3Store: emptyStore } = await createDenoKvPersistedN3Store(kv, key);
    assertEquals(emptyStore.size, 0);
  } finally {
    kv.close();
  }
});

Deno.test("setN3StoreToKv and getN3StoreFromKv - direct operations", async () => {
  const kv = await Deno.openKv(":memory:");
  const key = ["test", "direct", "store"];

  try {
    // Create a store and add data for direct operations testing.
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      DataFactory.namedNode("http://schema.org/Person"),
      DataFactory.defaultGraph(),
    );

    store.addQuad(quad);
    assertEquals(store.size, 1);

    // Store directly to KV using the set function.
    await setN3StoreToKv(kv, key, store);

    // Retrieve from KV using the get function.
    const loadedStore = await getN3StoreFromKv(kv, key);
    assertExists(loadedStore);
    assertEquals(loadedStore!.size, 1);
    assertExists(loadedStore!.has(quad));
  } finally {
    await removeN3StoreFromKv(kv, key);
    kv.close();
  }
});

Deno.test("setN3StoreToKv - with custom format", async () => {
  const kv = await Deno.openKv(":memory:");
  const key = ["test", "format"];

  try {
    const store = new CustomN3Store();
    const quad = DataFactory.quad(
      DataFactory.namedNode("http://example.org/person1"),
      DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      DataFactory.namedNode("http://schema.org/Person"),
      DataFactory.defaultGraph(),
    );

    store.addQuad(quad);

    // Store with custom format and expiration options.
    await setN3StoreToKv(kv, key, store, {
      format: "application/n-triples",
      expireIn: 1000,
    });

    // Retrieve and verify the data was stored correctly.
    const loadedStore = await getN3StoreFromKv(kv, key);
    assertExists(loadedStore);
    assertEquals(loadedStore!.size, 1);
  } finally {
    await removeN3StoreFromKv(kv, key);
    kv.close();
  }
});

Deno.test("getN3StoreFromKv - returns null for non-existent key", async () => {
  const kv = await Deno.openKv(":memory:");
  const key = ["non", "existent"];

  try {
    // Attempt to retrieve a store that does not exist.
    const store = await getN3StoreFromKv(kv, key);
    assertEquals(store, null);
  } finally {
    kv.close();
  }
});

Deno.test("kv-toolbox blob integration - large data handling", async () => {
  const kv = await Deno.openKv(":memory:");
  const key = ["test", "large", "blob"];

  try {
    // Create a store with multiple quads to test blob chunking functionality.
    const store = new CustomN3Store();

    // Add multiple quads to create a larger dataset for testing.
    for (let i = 0; i < 10; i++) {
      const quad = DataFactory.quad(
        DataFactory.namedNode(`http://example.org/person${i}`),
        DataFactory.namedNode(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        ),
        DataFactory.namedNode("http://schema.org/Person"),
        DataFactory.defaultGraph(),
      );
      store.addQuad(quad);
    }

    assertEquals(store.size, 10);

    // Store as blob using kv-toolbox's chunking capabilities.
    await setN3StoreToKv(kv, key, store);

    // Retrieve and verify all data was stored correctly.
    const loadedStore = await getN3StoreFromKv(kv, key);
    assertExists(loadedStore);
    assertEquals(loadedStore!.size, 10);

    // Verify all quads are present and accessible.
    for (let i = 0; i < 10; i++) {
      const expectedQuad = DataFactory.quad(
        DataFactory.namedNode(`http://example.org/person${i}`),
        DataFactory.namedNode(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        ),
        DataFactory.namedNode("http://schema.org/Person"),
        DataFactory.defaultGraph(),
      );
      assertExists(loadedStore!.has(expectedQuad));
    }
  } finally {
    await removeN3StoreFromKv(kv, key);
    kv.close();
  }
});
