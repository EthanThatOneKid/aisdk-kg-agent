import {
  getAsBlob,
  remove as removeBlob,
  set as setBlob,
} from "@kitsonk/kv-toolbox/blob";
import { persist, restore } from "@orama/plugin-data-persistence";
import { createOramaTripleStore } from "src/orama/triple-store.ts";
import type { OramaTripleStore } from "src/orama/triple-store.ts";

/**
 * createDenoKvPersistedOramaTripleStore creates an Orama triple store that persists to Deno.Kv storage.
 * This function loads existing data from the KV store if available and provides a persist method for saving changes.
 */
export async function createDenoKvPersistedOramaTripleStore(
  kv: Deno.Kv,
  key: Deno.KvKey,
  options?: KvOramaOptions,
) {
  try {
    const blob = await getAsBlob(kv, key, {
      consistency: options?.consistency,
    });
    if (blob !== null) {
      const json = await blob.text();
      const orama = await restore<OramaTripleStore>("json", json);
      return {
        orama,
        persist: async () => {
          const data = await persist(orama, "json");
          if (typeof data !== "string") {
            throw new Error("Data is not a string");
          }
          const mime = options?.format ?? "application/json";
          const outBlob = new Blob([data], { type: mime });
          await setBlob(kv, key, outBlob, { expireIn: options?.expireIn });
        },
      };
    }
  } catch (_error) {
    // Fall through to create a fresh instance below if read fails.
  }

  const orama = await createOramaTripleStore();
  return {
    orama,
    persist: async () => {
      const data = await persist(orama, "json");
      if (typeof data !== "string") {
        throw new Error("Data is not a string");
      }
      const mime = options?.format ?? "application/json";
      const blob = new Blob([data], { type: mime });
      await setBlob(kv, key, blob, { expireIn: options?.expireIn });
    },
  };
}

/**
 * setOramaToKv serializes an Orama triple store and stores it in Deno.Kv as a blob.
 */
export async function setOramaToKv(
  kv: Deno.Kv,
  key: Deno.KvKey,
  orama: OramaTripleStore,
  options?: Pick<KvOramaOptions, "expireIn" | "format">,
): Promise<Deno.KvCommitResult> {
  const data = await persist(orama, "json");
  if (typeof data !== "string") {
    throw new Error("Data is not a string");
  }

  const mimeType = options?.format ?? "application/json";
  const blob = new Blob([data], { type: mimeType });
  return await setBlob(kv, key, blob, { expireIn: options?.expireIn });
}

/**
 * getOramaJsonFromKv retrieves the stored Orama JSON string from Deno.Kv.
 * Returns null if the key does not exist.
 */
export async function getOramaJsonFromKv(
  kv: Deno.Kv,
  key: Deno.KvKey,
  options?: Pick<KvOramaOptions, "consistency">,
): Promise<string | null> {
  const blob = await getAsBlob(kv, key, { consistency: options?.consistency });
  if (blob !== null) {
    return await blob.text();
  }

  return null;
}

/**
 * getOramaFromKv retrieves and restores the Orama triple store from Deno.Kv.
 * Returns null if the key does not exist.
 */
export async function getOramaFromKv(
  kv: Deno.Kv,
  key: Deno.KvKey,
  options?: Pick<KvOramaOptions, "consistency">,
): Promise<OramaTripleStore | null> {
  const json = await getOramaJsonFromKv(kv, key, options);
  if (json !== null) {
    return await restore<OramaTripleStore>("json", json);
  }

  return null;
}

/**
 * removeOramaFromKv removes the persisted Orama store from Deno.Kv.
 * This ensures complete deletion of the stored blob and associated metadata.
 */
export async function removeOramaFromKv(
  kv: Deno.Kv,
  key: Deno.KvKey,
): Promise<void> {
  await removeBlob(kv, key);
}

/**
 * KvOramaOptions are the options for KV-based Orama persistence.
 * These options control consistency levels, expiration times, and serialization formats.
 */
export interface KvOramaOptions {
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
   * format is the MIME type of the stored blob, typically "application/json".
   */
  format?: string;
}
