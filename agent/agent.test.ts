import { assert, assertEquals } from "@std/assert";
import { generateTurtle, type KgAgent } from "#/agent.ts";

class MockAgent {
  public prompts: string[] = [];
  private responses: string[];

  constructor(responses: string[]) {
    this.responses = responses;
  }

  generate({ prompt }: { prompt: string }): Promise<{ text: string }> {
    this.prompts.push(prompt);
    const text = this.responses.shift() ?? "";
    return Promise.resolve({ text });
  }
}

function asKgAgent(agent: MockAgent): KgAgent {
  return agent as unknown as KgAgent;
}

Deno.test("generateTurtle: returns valid Turtle on first try", async () => {
  const turtle = [
    "@prefix ex: <http://example.org/> .",
    "",
    "ex:a ex:b ex:c .",
  ].join("\n");
  const agent = new MockAgent([turtle]);
  const { turtle: out, rawText } = await generateTurtle(
    asKgAgent(agent),
    "Input text",
  );
  assertEquals(out.trim(), turtle);
  assertEquals(rawText.trim(), turtle);
  assertEquals(agent.prompts.length, 1);
});

Deno.test("generateTurtle: retries on invalid and succeeds second time", async () => {
  const invalid = "```turtle\nthis is not turtle\n```";
  const valid = [
    "@prefix ex: <http://example.org/> .",
    "",
    "ex:a ex:b ex:c .",
  ].join("\n");
  const agent = new MockAgent([invalid, valid]);
  const { turtle } = await generateTurtle(asKgAgent(agent), "Another input");
  assertEquals(turtle.trim(), valid);
  assertEquals(agent.prompts.length, 2);
  const retryPrompt = agent.prompts[1];
  assert(retryPrompt.includes("not valid Turtle"));
  assert(retryPrompt.includes("Parser error:"));
});

Deno.test("generateTurtle: throws when invalid after retry", async () => {
  const invalid1 = "```turtle\nthis is not turtle\n```";
  const invalid2 = "still not turtle";
  const agent = new MockAgent([invalid1, invalid2]);
  let threw = false;
  try {
    await generateTurtle(asKgAgent(agent), "Bad input");
  } catch (_err) {
    threw = true;
  }
  assert(threw);
  assertEquals(agent.prompts.length, 2);
});
