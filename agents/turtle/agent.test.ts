import { assert, assertEquals } from "@std/assert";
import { generateValidTurtle, turtleAgent } from "./agent.ts";

class MockAgent {
  public prompts: Array<{ role: "user" | "assistant"; content: string }> = [];
  private responses: string[];

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async generate(
    { messages }: {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    },
  ): Promise<{ text: string }> {
    this.prompts.push(...messages);
    const text = this.responses.shift() ?? "";
    return { text };
  }
}

Deno.test("turtle agent: returns valid Turtle on first try", async () => {
  const valid = [
    "@prefix ex: <http://example.org/> .",
    "",
    "ex:a ex:b ex:c .",
  ].join("\n");
  const agent = new MockAgent([valid]);
  const turtle = await generateValidTurtle(
    agent as unknown as typeof turtleAgent,
    "Analyze this.",
  );
  assertEquals(turtle.trim(), valid);
});

Deno.test("turtle agent: retries once and succeeds", async () => {
  const invalid = "```turtle\nthis is not turtle\n```";
  const valid = [
    "@prefix ex: <http://example.org/> .",
    "",
    "ex:a ex:b ex:c .",
  ].join("\n");
  const agent = new MockAgent([invalid, valid]);
  const turtle = await generateValidTurtle(
    agent as unknown as typeof turtleAgent,
    "Analyze again.",
  );
  assertEquals(turtle.trim(), valid);
});

Deno.test("turtle agent: throws after max retries", async () => {
  const invalid1 = "```turtle\nthis is not turtle\n```";
  const invalid2 = "still not turtle";
  const agent = new MockAgent([invalid1, invalid2]);
  let threw = false;
  try {
    await generateValidTurtle(
      agent as unknown as typeof turtleAgent,
      "Analyze again.",
    );
  } catch (_e) {
    threw = true;
  }
  assert(threw);
});
