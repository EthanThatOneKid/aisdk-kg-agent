// import { persistToFile, restoreFromFile } from "@orama/plugin-data-persistence";
import { persist, restore } from "@orama/plugin-data-persistence";
import { createOramaTripleStore } from "./triple-store.ts";
import type { OramaTripleStore } from "./triple-store.ts";

/**
 * createDenoPersistedOramaTripleStore creates a persisted Orama triple store.
 * If the file doesn't exist, it creates a new instance.
 *
 * @see
 * https://docs.oramasearch.com/docs/orama-js/plugins/plugin-data-persistence
 */
export async function createDenoPersistedOramaTripleStore(path: string) {
  try {
    const data = await Deno.readTextFile(path);
    const orama = await restore<OramaTripleStore>("json", data);
    return {
      orama,
      persist: async () => {
        const data = await persist(orama, "json");
        if (typeof data !== "string") {
          throw new Error("Data is not a string");
        }
        await Deno.writeTextFile(path, data);
      },
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log(`Orama file ${path} not found, creating new instance...`);
      const orama = await createOramaTripleStore();
      return {
        orama,
        persist: async () => {
          const data = await persist(orama, "json");
          if (typeof data !== "string") {
            throw new Error("Data is not a string");
          }

          await Deno.writeTextFile(path, data);
        },
      };
    }

    throw error;
  }
}
