/**
 * Deno.Kv persistence implementation for CustomN3Store using @kitsonk/kv-toolbox.
 *
 * @example
 * ```ts
 * import {
 *   createDenoKvPersistedN3Store,
 *   setN3StoreToKv,
 *   getN3StoreFromKv
 * } from "n3store/persist/kv.ts";
 *
 * const kv = await Deno.openKv();
 *
 * // Method 1: Persistent store with automatic persistence
 * const { n3Store, persist } = await createDenoKvPersistedN3Store(
 *   kv,
 *   ["my", "n3store"],
 *   {
 *     expireIn: 3600000, // 1 hour expiration
 *     format: "text/turtle" // or "application/n-triples"
 *   }
 * );
 * n3Store.addQuad(quad);
 * await persist();
 *
 * // Method 2: Direct store operations
 * const store = new CustomN3Store();
 * store.addQuad(quad);
 * await setN3StoreToKv(kv, ["direct", "store"], store);
 *
 * const loadedStore = await getN3StoreFromKv(kv, ["direct", "store"]);
 * ```
 */

import {
  getAsBlob,
  remove as removeBlob,
  set as setBlob,
} from "@kitsonk/kv-toolbox/blob";
import { CustomN3Store } from "n3store/custom-n3store.ts";
import { exportTurtle, insertTurtle } from "n3store/turtle.ts";

/**
 * createDenoKvPersistedN3Store creates a CustomN3Store that persists to Deno.Kv storage.
 * This function loads existing data from the KV store if available and provides a persist method for saving changes.
 */
export async function createDenoKvPersistedN3Store(
  kv: Deno.Kv,
  key: Deno.KvKey,
  options?: KvN3StoreOptions,
) {
  const n3Store = new CustomN3Store();

  try {
    // Try to load existing data from KV store as blob.
    const blob = await getAsBlob(kv, key, {
      consistency: options?.consistency,
    });
    if (blob !== null) {
      const turtleData = await blob.text();
      insertTurtle(n3Store, turtleData);
    }
  } catch (_error) {
    console.log("No existing data found in KV store, starting with fresh data");
  }

  return {
    n3Store,
    persist: async () => {
      const data = await exportTurtle(n3Store);
      const format = options?.format || "text/turtle";
      const blob = new Blob([data], { type: format });
      await setBlob(kv, key, blob, { expireIn: options?.expireIn });
    },
  };
}

/**
 * setN3StoreToKv sets a CustomN3Store directly to Deno.Kv storage as a blob.
 * This function exports the store as Turtle format and stores it using kv-toolbox's blob storage.
 */
export async function setN3StoreToKv(
  kv: Deno.Kv,
  key: Deno.KvKey,
  store: CustomN3Store,
  options?: Pick<KvN3StoreOptions, "expireIn" | "format">,
): Promise<Deno.KvCommitResult> {
  const data = await exportTurtle(store);
  const format = options?.format || "text/turtle";
  const blob = new Blob([data], { type: format });
  return await setBlob(kv, key, blob, { expireIn: options?.expireIn });
}

/**
 * getN3StoreFromKv gets a CustomN3Store directly from Deno.Kv storage.
 * This function retrieves blob data from the KV store and reconstructs the N3Store.
 * Returns null if the key does not exist.
 */
export async function getN3StoreFromKv(
  kv: Deno.Kv,
  key: Deno.KvKey,
  options?: Pick<KvN3StoreOptions, "consistency">,
): Promise<CustomN3Store | null> {
  const blob = await getAsBlob(kv, key, { consistency: options?.consistency });
  if (blob !== null) {
    const store = new CustomN3Store();
    const turtleData = await blob.text();
    insertTurtle(store, turtleData);
    return store;
  }
  return null;
}

/**
 * removeN3StoreFromKv removes the persisted N3 store from Deno.Kv storage.
 * This function uses kv-toolbox's remove function to properly handle blob chunks and sub-keys.
 * It ensures complete deletion of all associated data including metadata.
 */
export async function removeN3StoreFromKv(
  kv: Deno.Kv,
  key: Deno.KvKey,
): Promise<void> {
  await removeBlob(kv, key);
}

/**
 * KvN3StoreOptions are the options for KV-based N3Store persistence.
 * These options control consistency levels, expiration times, and serialization formats.
 */
export interface KvN3StoreOptions {
  /**
   * consistency is the consistency level for the Kv store.
   * This controls whether reads use eventual or strong consistency.
   */
  consistency?: Deno.KvConsistencyLevel;

  /**
   * expireIn is the expiration time for the Kv store in milliseconds.
   * The data will be automatically deleted after this time period.
   */
  expireIn?: number;

  /**
   * format is the serialization format of the store.
   * Common formats include "text/turtle" and "application/n-triples".
   */
  format?: string;
}
