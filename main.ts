import { google } from "@ai-sdk/google";
import { generateTurtle } from "agents/turtle/generate.ts";
import { recognizeEntities } from "agents/ner/nlp.ts";
import {
  autosuggest,
  generateSuggestions,
} from "agents/ner/search/suggestions.ts";
import {
  createOramaTripleStore,
  OramaSearchService,
} from "agents/ner/search/orama/search.ts";
import schemaShapes from "agents/turtle/shacl/datashapes.org/schema.ttl" with {
  type: "text",
};

if (import.meta.main) {
  try {
    const model = google("models/gemini-2.5-flash");

    const orama = createOramaTripleStore();
    const searchService = new OramaSearchService(orama);

    console.log("Processing text...");

    const inputText =
      "I met up with Kyle at the Lost Bean cafe yesterday in the morning.";
    const nerResult = recognizeEntities(inputText);

    console.log("Generating suggestions...");

    const suggestions = await generateSuggestions(
      searchService,
      { entities: nerResult },
    );

    // Wait for user to select or choose to auto-resolve entities.
    // User may create a new ID for an entity here, as long as it's a valid, unique IRI.
    const references = autosuggest(suggestions);

    console.log("Generating Turtle...");
    const ttl = await generateTurtle(model, {
      inputText,
      references,
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
    });

    console.log("Input text:", inputText);
    console.log("Generated Turtle:");
    console.log(ttl);
    console.log("Turtle length:", ttl.length);

    await Deno.writeTextFile("./result.ttl", ttl);
  } catch (error) {
    console.error("=== ERROR DETAILS ===");
    console.error("Error name:", (error as Error).name);
    console.error("Error message:", (error as Error).message);
    console.error("Error stack:", (error as Error).stack);

    // Check if it's a Google API error
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
