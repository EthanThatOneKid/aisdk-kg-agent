import { CustomN3Store } from "./custom-n3store.ts";
import { exportTurtle, insertTurtle } from "./turtle.ts";

export async function createPersistedN3Store(filePath: string) {
  const n3Store = new CustomN3Store();
  try {
    const data = await Deno.readTextFile(filePath);
    insertTurtle(n3Store, data);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log("No existing db.ttl found, starting with fresh data");
    } else {
      throw error;
    }
  }

  return {
    n3Store,
    persist: async () => {
      const data = await exportTurtle(n3Store);
      await Deno.writeTextFile(filePath, data);
    },
  };
}
