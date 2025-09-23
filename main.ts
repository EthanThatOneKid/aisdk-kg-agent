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
      {
        entities: nerResult,
        user: { id: "https://fartlabs.org#me" },
        generateId: () =>
          `https://fartlabs.org/.well-known/genid/${crypto.randomUUID()}`,
      },
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

    console.log(inputText);
    console.log(ttl);

    await Deno.writeTextFile("./result.ttl", ttl);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    console.log("Done.");
  }
}
