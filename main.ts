import { google } from "@ai-sdk/google";
import { generateTurtle } from "agents/turtle/generate.ts";
import { EntityLinker } from "agents/linker/entity-linker.ts";
import { CompromiseService } from "agents/linker/ner/compromise/ner.ts";
import { PromptDisambiguationService } from "agents/linker/disambiguation/cli/disambiguation.ts";
import { OramaSearchService } from "agents/linker/search/orama/search.ts";
import { createDenoPersistedOramaTripleStore } from "agents/linker/search/orama/persist.ts";
import { insertTurtle } from "agents/turtle/turtle.ts";
import {
  createPlaceholderMapping,
  replacePlaceholderIds,
} from "agents/turtle/placeholder-replacer.ts";
import shaclShapes from "agents/turtle/shacl/datashapes.org/schema.ttl" with {
  type: "text",
};
import { createManagedN3Store } from "./n3store/custom-n3store.ts";
import { OramaSyncInterceptor } from "./n3store/interceptor/orama-sync-interceptor.ts";

const config = {
  fast: true,
  clean: true,
  verbose: true,
  oramaPath: "./orama.json",
  n3StorePath: "./db.ttl",
};

if (import.meta.main) {
  try {
    if (config.clean) {
      // Clean up existing files to start fresh.
      try {
        await Deno.remove(config.oramaPath);
        if (config.verbose) {
          console.log(`🗑️ Deleted existing ${config.oramaPath}`);
        }
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          console.warn(`Warning: Could not delete ${config.oramaPath}:`, error);
        }
      }

      try {
        await Deno.remove(config.n3StorePath);
        if (config.verbose) {
          console.log(`🗑️ Deleted existing ${config.n3StorePath}`);
        }
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          console.warn(
            `Warning: Could not delete ${config.n3StorePath}:`,
            error,
          );
        }
      }
    }

    const model = google("models/gemini-2.5-flash");
    const { orama, persist: persistOrama } =
      await createDenoPersistedOramaTripleStore(config.oramaPath);

    const searchService = new OramaSearchService(orama);
    const disambiguationService = new PromptDisambiguationService();
    const nerService = new CompromiseService();

    // Create a managed N3Store for SPARQL queries.
    const { n3Store, persist: persistN3Store } = await createManagedN3Store(
      config.n3StorePath,
    );

    // Create an interceptor to sync N3 store changes with Orama store.
    const oramaSyncInterceptor = new OramaSyncInterceptor(orama);
    n3Store.addInterceptor(oramaSyncInterceptor);

    // Use the new entity discovery service instead of NER.
    const entityDiscoveryService = new EntityLinker(
      nerService,
      searchService,
      disambiguationService,
    );

    while (true) {
      const inputText = config.fast
        ? "I went to the store today"
        : prompt("USER>");
      if (!inputText) {
        console.error("No input text provided");
        continue;
      }

      // Step 1: Generate Turtle with placeholders (fast, no external dependencies)
      if (config.verbose) {
        console.log("Generating Turtle with placeholders...");
      }
      const timestamp = new Intl.DateTimeFormat(
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
      ).format(new Date());
      const result = await generateTurtle(model, {
        inputText,
        timestamp,
        shaclShapes,
        verbose: config.verbose,
      });

      // Step 2: Use entities directly from structured output
      if (config.verbose) {
        console.log("Using entities from structured output...");
      }
      const extractedEntities = result.entities;
      if (config.verbose) {
        console.log(
          `Found ${extractedEntities.length} entities:`,
          extractedEntities,
        );
      }

      // Step 3: Perform entity linking on the extracted entities
      if (config.verbose) {
        console.log("Performing entity linking on extracted entities...");
      }
      const linkedEntities = await entityDiscoveryService.linkExtractedEntities(
        extractedEntities,
      );

      // Step 4: Create placeholder mapping using linked entities
      if (config.verbose) {
        console.log("Creating placeholder mapping...");
      }
      const placeholderMapping = createPlaceholderMapping(
        extractedEntities,
        linkedEntities,
      );

      // Step 5: Replace placeholders with final IDs
      if (config.verbose) {
        console.log("Replacing placeholders with final IDs...");
      }
      const ttl = replacePlaceholderIds(result.turtle, placeholderMapping);

      // Debug: Log the actual generated Turtle content.
      if (config.verbose) {
        console.log("🔍 Generated Turtle content:");
        console.log("Length:", ttl.length);
        console.log("Content:", JSON.stringify(ttl));
        console.log("Raw content:", ttl);
      }

      // Add the generated Turtle to the N3 store for persistence.
      insertTurtle(n3Store, ttl);

      // Save the N3 store to db.ttl for persistence.
      await persistN3Store();

      // Save the Orama database for persistence.
      await persistOrama();

      if (config.verbose) {
        console.log(
          `Added generated Turtle to N3 store. Total triples: ${n3Store.size}`,
        );
      }

      if (config.fast) {
        break;
      }
    }
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

export function genid(id: string): string {
  return `https://fartlabs.org/.well-known/genid/${id}`;
}
