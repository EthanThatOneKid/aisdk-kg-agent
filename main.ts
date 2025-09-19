import { google } from "@ai-sdk/google";
import { Experimental_Agent as Agent } from "ai";

const gemini = google("models/gemini-2.5-flash-lite");

const agent = new Agent({
  model: gemini,
  system:
    "You are a helpful assistant powered by Google Gemini. You provide accurate and informative answers to questions.",
});

if (import.meta.main) {
  try {
    const result = await agent.generate({
      prompt: "What is the largest moon of Jupiter?",
    });
    console.log(result.text);
  } catch (error) {
    console.error("Error:", error);
  }
}
