import { Experimental_Agent as Agent } from "ai";
import { google } from "@ai-sdk/google";
import { QueryEngine } from "@comunica/query-sparql";
import { sparql } from "./agent/tools/sparql.ts";
import { analyze } from "./agent/nlp/compromise.ts";

const gemini = google("models/gemini-2.5-flash-lite");
const queryEngine = new QueryEngine();

const _agent = new Agent({
  model: gemini,
  system: "Build a knowledge graph from user conversations.",
  tools: {
    sparql: sparql({ queryEngine }),
  },
});

if (import.meta.main) {
  try {
    console.log("Generating Entity Relationship Report...");
    const inputText = "I met up with Kyle at the Lost Bean cafe yesterday.";
    const analysis = analyze(inputText);

    // Save the structured report.
    await Deno.writeTextFile(
      "analysis.json",
      JSON.stringify(analysis, null, 2),
    );

    console.log("\n=== SUMMARY ===");
    if (analysis.length > 0) {
      const report = analysis[0];
      console.log(
        `Found ${report.summary.totalEntities} entities, ${report.summary.totalRelationships} relationships, and ${report.summary.totalLocations} locations.`,
      );

      if (report.entities.length > 0) {
        console.log("\nEntities:");
        report.entities.forEach((entity) => {
          console.log(
            `- ${entity.text} (${entity.type}) [${entity.range.start}-${entity.range.end}]`,
          );
        });
      }

      if (report.relationships.length > 0) {
        console.log("\nRelationships:");
        report.relationships.forEach((rel) => {
          console.log(
            `- ${rel.subjectText} ${rel.predicate} ${rel.objectText} (${rel.type})`,
          );
        });
      }

      if (report.locations.length > 0) {
        console.log("\nLocations:");
        report.locations.forEach((loc) => {
          console.log(`- ${loc.text} (${loc.properties.category})`);
        });
      }
    }

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
