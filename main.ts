import { Experimental_Agent as Agent } from "ai";
import { google } from "@ai-sdk/google";
import { QueryEngine } from "@comunica/query-sparql";
import { sparql } from "./agent/tools/sparql.ts";
import { analyzeContent } from "./agent/nlp/compromise.ts";

const gemini = google("models/gemini-2.5-flash-lite");
const queryEngine = new QueryEngine();

const _agent = new Agent({
  model: gemini,
  system:
    "Extract facts from text and convert them into RDF triples in Turtle format.",
  tools: {
    sparql: sparql({ queryEngine }),
  },
});

if (import.meta.main) {
  try {
    console.log("Generating...");
    const inputText =
      "I met up with Kyle at the Lost Bean cafe yesterday in the morning.";
    const analysis = analyzeContent(inputText);

    // Save the structured report.
    await Deno.writeTextFile(
      "analysis.json",
      JSON.stringify(analysis, null, 2),
    );

    // const result = await agent.generate({
    //   prompt: `Analyze the following text: ${inputText}`,
    // });
    // console.log("Result:", result.text);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    console.log("Done.");
  }
}
