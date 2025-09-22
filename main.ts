import {
  createOramaTripleStore,
  OramaSearchService,
} from "#/search/orama-search.ts";
import { NerAgent } from "./agents/ner/agent.ts";
import { generateValidTurtle, turtleAgent } from "./agents/turtle/agent.ts";

if (import.meta.main) {
  try {
    const orama = createOramaTripleStore();
    const searchService = new OramaSearchService(orama);
    const nerAgent = new NerAgent(searchService);

    console.log("Processing text...");

    const inputText =
      "I met up with Kyle at the Lost Bean cafe yesterday in the morning.";

    // Process named entities
    const nerResult = await nerAgent.processText(inputText);
    nerAgent.logResults(nerResult);

    // Generate Turtle
    const prompt = `Analyze the following text:\n${inputText}`;
    console.log("Prompt:", prompt);

    const turtle = await generateValidTurtle(turtleAgent, prompt, 2);
    console.log("Valid Turtle generated.");
    await Deno.writeTextFile("result.ttl", turtle);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    console.log("Done.");
  }
}
