import { Experimental_Agent as Agent } from "ai";
import { google } from "@ai-sdk/google";
import { QueryEngine } from "@comunica/query-sparql";
import { sparql } from "./agent/tools/sparql.ts";
import {
  createOramaTripleStore,
  OramaSearchService,
} from "./agent/search/orama-search.ts";
import { recognizeNamedEntities } from "./agent/nlp/ner.ts";
import { recognizeEntityGroups } from "./agent/nlp/compromise.ts";
import { Parser as N3Parser } from "n3";

const gemini = google("models/gemini-2.5-flash");
const queryEngine = new QueryEngine();

const SYSTEM_PROMPT = [
  "You convert input text into RDF triples using Turtle syntax.",
  "Output only valid Turtle, with no explanations or extra text.",
  "Use these prefixes (include them if you use the terms):",
  "@prefix ex: <http://example.org/> .",
  "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
  "",
  "Rules:",
  "- Represent facts as subject predicate object .",
  "- End every triple with a period.",
  '- Use literals with quotes and datatypes when appropriate (e.g., "2025-09-22"^^xsd:date).',
  "- If an entity has no known IRI, mint one under ex: (e.g., ex:Kyle).",
  "- If nothing factual can be extracted, output an empty Turtle document (just prefixes or nothing).",
  "",
  "Examples:",
  "ex:Kyle ex:metAt ex:LostBeanCafe .",
  'ex:LostBeanCafe ex:locatedIn "Irvine" .',
  'ex:Meeting1 ex:participant ex:Kyle ; ex:participant ex:Alex ; ex:date "2025-09-22"^^xsd:date .',
  "",
  "Checklist before responding:",
  "- Only Turtle, no prose.",
  "- Valid syntax (prefixes first if used).",
  "- Each triple ends with a period.",
].join("\n");

const agent = new Agent({
  model: gemini,
  system: SYSTEM_PROMPT,
  tools: {
    sparql: sparql({ queryEngine }),
  },
});

function isValidTurtle(
  turtle: string,
): { ok: true } | { ok: false; error: string } {
  try {
    const parser = new N3Parser();
    // The parse method throws on invalid Turtle.
    parser.parse(turtle);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

if (import.meta.main) {
  try {
    const orama = createOramaTripleStore();
    const searchService = new OramaSearchService(orama);

    console.log("Generating...");

    const inputText =
      "I met up with Kyle at the Lost Bean cafe yesterday in the morning.";
    const clauses = recognizeEntityGroups(inputText);
    const namedEntities = await recognizeNamedEntities(searchService, clauses);
    for (const clause of clauses) {
      console.log(clause.text);
      for (const entity of clause.entities) {
        console.log(entity.text, namedEntities.get(entity.text));
      }
    }

    console.log(
      "Prompt:",
      `Analyze the following text:\n${inputText}`,
    );

    // First attempt with low temperature.
    let result = await agent.generate({
      prompt: `Analyze the following text:\n${inputText}`,
    });

    // Validate Turtle output; retry once if invalid.
    let validation = isValidTurtle(result.text.trim());
    if (!validation.ok) {
      console.warn("Turtle parse failed. Retrying once...", validation.error);
      const retryPrompt = [
        "Your previous output was not valid Turtle.",
        `Parser error: ${validation.error}`,
        "Re-output the triples as valid Turtle only. No explanations.",
        "Use the same instructions and prefixes.",
        "Input text:",
        inputText,
      ].join("\n\n");

      result = await agent.generate({
        prompt: retryPrompt,
      });

      validation = isValidTurtle(result.text.trim());
    }

    console.log("Result:", result);
    await Deno.writeTextFile("result.ttl", result.text.trim());
  } catch (error) {
    console.error("Error:", error);
  } finally {
    console.log("Done.");
  }
}
