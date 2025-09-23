import { google } from "@ai-sdk/google";
import { generateSparql } from "agents/sparql/generate.ts";
import { recognizeEntities } from "agents/ner/nlp.ts";
import {
  autosuggest,
  generateSuggestions,
} from "agents/ner/search/suggestions.ts";
import {
  createOramaTripleStore,
  OramaSearchService,
} from "agents/ner/search/orama/search.ts";

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

    console.log("Generating SPARQL query...");

    const sparqlQuery = await generateSparql(model, {
      inputText,
      references,
      generateTimestamp: () => new Date().toISOString(),
    });

    console.log(inputText);
    console.log(sparqlQuery);

    await Deno.writeTextFile("./result.sparql", sparqlQuery);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    console.log("Done.");
  }
}
