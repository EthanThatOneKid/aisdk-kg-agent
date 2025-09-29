import { persist, restore } from "@orama/plugin-data-persistence";
import { createOramaTripleStore } from "agents/linker/search/orama/triple-store.ts";
import type { OramaTripleStore } from "agents/linker/search/orama/triple-store.ts";

/**
 * createDenoPersistedOramaTripleStore creates a persisted Orama triple store.
 * If the file doesn't exist, it creates a new instance.
 *
 * @see
 * https://docs.oramasearch.com/docs/orama-js/plugins/plugin-data-persistence
 */
export async function createDenoPersistedOramaTripleStore(path: string) {
  const persistOrama = (orama: OramaTripleStore) => async () => {
    const data = await persist(orama, "json");
    if (typeof data !== "string") {
      throw new Error("Data is not a string");
    }

    await Deno.writeTextFile(path, data);
    return data;
  };

  try {
    const data = await Deno.readTextFile(path);
    const orama = await restore<OramaTripleStore>("json", data);

    return {
      orama,
      persist: persistOrama(orama),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // Orama file not found, create a new instance.
      const orama = await createOramaTripleStore();
      return {
        orama,
        persist: persistOrama(orama),
      };
    }

    throw error;
  }
}

/**
 * removeOrama removes the persisted Orama store file.
 */
export async function removeOrama(filePath: string): Promise<void> {
  try {
    await Deno.remove(filePath);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}
