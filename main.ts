import { google } from "@ai-sdk/google";
import { Writer } from "n3";
import { generateTurtle } from "agents/turtle/generate.ts";
import { EntityDiscoveryService } from "agents/ner/search/entity-discovery.ts";
import {
  createManagedOramaTripleStore,
  OramaSearchService,
} from "agents/ner/search/orama/search.ts";
import { CustomN3Store } from "./n3store/custom-n3store.ts";
import { OramaSyncInterceptor } from "./n3store/interceptor/orama-sync-interceptor.ts";
import { insertTurtle } from "agents/turtle/insert.ts";
import schemaShapes from "agents/turtle/shacl/datashapes.org/schema.ttl" with {
  type: "text",
};

const config = {
  oramaPath: "./orama.json",
  tripleStorePath: "./db.ttl",
};

if (import.meta.main) {
  try {
    const model = google("models/gemini-2.5-flash");
    const { orama, persist } = await createManagedOramaTripleStore(
      config.oramaPath,
    );

    const searchService = new OramaSearchService(orama);

    // Create a CustomN3Store for SPARQL queries.
    const n3Store = new CustomN3Store();

    // Create an interceptor to sync N3 store changes with Orama store.
    const oramaSyncInterceptor = new OramaSyncInterceptor(orama);
    n3Store.addInterceptor(oramaSyncInterceptor);

    // Try to restore existing data from db.ttl.
    try {
      const existingData = await Deno.readTextFile("./db.ttl");
      if (existingData.trim()) {
        insertTurtle(n3Store, existingData);
        console.log(`Restored ${n3Store.size} triples from db.ttl`);
      }
    } catch (_error) {
      console.log("No existing db.ttl found, starting with fresh data");
    }

    console.log(`Orama store synchronized with N3 store`);
    const inputText =
      "I met up with Kyle at the Lost Bean cafe yesterday in the morning.";

    console.log("Discovering entities using LLM-driven approach...");

    // Use the new entity discovery service instead of NER.
    const entityDiscoveryService = new EntityDiscoveryService(searchService);
    const discovery = await entityDiscoveryService.discoverEntities(inputText);

    console.log(`Found ${discovery.totalCandidates} entity candidates:`);
    for (const [candidate, entityDiscovery] of discovery.discoveries) {
      console.log(
        `  - "${candidate}": ${
          entityDiscovery.found
            ? `${entityDiscovery.matches} matches`
            : "not found"
        }`,
      );
    }

    // Create reconnaissance context to guide the LLM.
    const reconnaissanceContext = entityDiscoveryService
      .createReconnaissanceContext(discovery);
    console.log("\nReconnaissance context:");
    console.log(reconnaissanceContext);

    console.log("Generating Turtle...");
    const ttl = await generateTurtle(model, {
      inputText,
      references: [], // No pre-resolved references - let LLM handle everything
      timestamp: new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone: "America/Los_Angeles",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        },
      ).format(new Date()),
      shaclShapes: schemaShapes,
      sources: [n3Store], // Pass the N3 store as a SPARQL source
      reconnaissanceContext, // Pass reconnaissance context
    });

    console.log("Input text:", inputText);
    console.log("Generated Turtle:");
    console.log(ttl);
    console.log("Turtle length:", ttl.length);

    // Add the generated Turtle to the N3 store for persistence.
    insertTurtle(n3Store, ttl);
    console.log(
      `Added generated Turtle to N3 store. Total triples: ${n3Store.size}`,
    );

    // Save the N3 store to db.ttl for persistence.
    const writer = new Writer({ format: "Turtle" });
    n3Store.forEach((quad) => writer.addQuad(quad));
    const dbTurtle = await new Promise<string>((resolve, reject) => {
      writer.end((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    await Deno.writeTextFile("./db.ttl", dbTurtle);
    console.log(`Saved ${n3Store.size} triples to db.ttl`);

    // Save the Orama database for persistence.
    await persist();
    console.log("Saved Orama database to orama.json");
  } catch (error) {
    console.error("=== ERROR DETAILS ===");
    console.error("Error name:", (error as Error).name);
    console.error("Error message:", (error as Error).message);
    console.error("Error stack:", (error as Error).stack);

    // Check if it's a Google API error.
    if ((error as Error).name === "AI_LoadAPIKeyError") {
      console.error("\n=== GOOGLE API ERROR ===");
      console.error(
        "This is a Google API key error. The application requires a valid Google Generative AI API key.",
      );
      console.error("To fix this, you need to:");
      console.error(
        "1. Get a Google AI API key from https://makersuite.google.com/app/apikey",
      );
      console.error(
        "2. Set the environment variable: GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here",
      );
      console.error("3. Or pass it directly to the google() function");
      console.error("\nCurrent environment variables:");
      console.error(
        "GOOGLE_GENERATIVE_AI_API_KEY:",
        Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ? "SET" : "NOT SET",
      );
    } else if ((error as Error).name === "AI_UnsupportedModelVersionError") {
      console.error("\n=== MODEL VERSION ERROR ===");
      console.error(
        "This is a model version compatibility error with the AI SDK.",
      );
    } else {
      console.error("\n=== OTHER ERROR ===");
      console.error(
        "This appears to be a different type of error, not related to the Google API.",
      );
    }

    console.error("\n=== FULL ERROR OBJECT ===");
    console.error(JSON.stringify(error, null, 2));
  } finally {
    console.log("Done.");
  }
}
