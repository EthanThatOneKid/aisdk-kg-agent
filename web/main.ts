import { route } from "@std/http/unstable-route";
import type { ServerSentEventMessage } from "@std/http/server-sent-event-stream";
import { ServerSentEventStream } from "@std/http/server-sent-event-stream";
import { google } from "@ai-sdk/google";
import { EntityLinker } from "agents/linker/entity-linker.ts";
import { TurtleGenerator } from "agents/turtle/generator.ts";
import { OramaSearchService } from "agents/linker/search/orama/search.ts";
import { createDenoKvPersistedOramaTripleStore } from "agents/linker/search/orama/persist/kv.ts";
import { GreedyDisambiguator } from "agents/linker/disambiguator/greedy/disambiguator.ts";
import { createDenoKvPersistedN3Store } from "n3store/persist/kv.ts";
import { exportTurtle, insertTurtle } from "n3store/turtle.ts";
import shapes from "n3store/shacl/datashapes.org/schema.ttl" with {
  type: "text",
};
import indexHtml from "./index.html" with { type: "text" };

const kv = await Deno.openKv();

export default {
  fetch: route(
    [
      {
        method: "GET",
        pattern: new URLPattern({ pathname: "/" }),
        handler: (_request: Request) => {
          return new Response(
            indexHtml,
            {
              status: 200,
              headers: { "Content-Type": "text/html" },
            },
          );
        },
      },
      {
        method: "GET",
        pattern: new URLPattern({ pathname: "/api/v1/graphs/:id" }),
        handler: async (_request: Request, params?: URLPatternResult) => {
          const id = params?.pathname.groups.id;
          if (!id) {
            return Response.json({ message: "Not found" }, { status: 404 });
          }

          const { n3Store } = await createDenoKvPersistedN3Store(
            kv,
            kvKeyTurtle(id),
          );
          const turtle = await exportTurtle(n3Store);
          return new Response(
            turtle,
            { headers: { "Content-Type": "text/turtle" } },
          );
        },
      },
      {
        method: "POST",
        pattern: new URLPattern({ pathname: "/api/v1/graphs/:id" }),
        handler: async (request: Request, params?: URLPatternResult) => {
          const id = params?.pathname.groups.id;
          if (!id) {
            return Response.json({ message: "Not found" }, { status: 404 });
          }

          const url = new URL(request.url);
          const inputText = url.searchParams.get("query");
          if (!inputText) {
            return Response.json({ message: "Missing query" }, { status: 400 });
          }

          let turtle: string | undefined;
          for await (const message of ingest(id, inputText)) {
            if (message.event !== "result") {
              continue;
            }

            turtle = message.data;
          }

          if (!turtle) {
            return Response.json(
              { message: "Failed to generate turtle" },
              { status: 500 },
            );
          }

          return new Response(
            turtle,
            { headers: { "Content-Type": "text/turtle" } },
          );
        },
      },
      {
        method: "POST",
        pattern: new URLPattern({ pathname: "/api/v1/graphs/:id/sse" }),
        handler: (request: Request, params?: URLPatternResult) => {
          const id = params?.pathname.groups.id;
          if (!id) {
            return Response.json({ message: "Not found" }, { status: 404 });
          }

          const url = new URL(request.url);
          const inputText = url.searchParams.get("query");
          if (!inputText) {
            return Response.json({ message: "Missing query" }, { status: 400 });
          }

          const stream = ReadableStream
            .from<ServerSentEventMessage>(ingest(id, inputText))
            .pipeThrough(new ServerSentEventStream());

          return new Response(
            stream,
            {
              headers: {
                "content-type": "text/event-stream",
                "cache-control": "no-cache",
              },
            },
          );
        },
      },
    ],
    () => Response.json({ message: "Not found" }, { status: 404 }),
  ),
} satisfies Deno.ServeDefaultExport;

export async function* ingest(
  id: string,
  inputText: string,
): AsyncGenerator<ServerSentEventMessage> {
  let eventId = 0;

  try {
    // Send connection confirmation
    yield {
      event: "connected",
      data: "Connected to generation stream",
      id: eventId++,
    };

    yield {
      event: "progress",
      data: "Loading store",
      id: eventId++,
    };

    const { n3Store, persist: persistN3Store } =
      await createDenoKvPersistedN3Store(kv, kvKeyTurtle(id));
    const { orama, persist: persistOrama } =
      await createDenoKvPersistedOramaTripleStore(kv, kvKeyOrama(id));

    yield {
      event: "progress",
      data: "Generating graph",
      id: eventId++,
    };

    const searchService = new OramaSearchService(orama);
    const disambiguator = new GreedyDisambiguator(() =>
      genid(crypto.randomUUID())
    );
    const entityLinker = new EntityLinker(
      searchService,
      disambiguator,
    );
    const turtleGenerator = new TurtleGenerator(entityLinker);
    const generatedTurtle = await turtleGenerator.generate({
      model: google("models/gemini-2.5-flash"),
      timestamp: formatTimestamp(),
      inputText,
      shapes,
    });

    yield {
      event: "progress",
      data: "Saving graph",
      id: eventId++,
    };

    await insertTurtle(n3Store, generatedTurtle);
    await persistN3Store();
    await persistOrama();

    const turtle = await exportTurtle(n3Store);
    yield {
      event: "result",
      data: turtle,
      id: eventId++,
    };

    // Send completion confirmation
    yield {
      event: "complete",
      data: "Generation completed successfully",
      id: eventId++,
    };
  } catch (error) {
    // Send error event
    yield {
      event: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
      id: eventId++,
    };
  }
}

function genid(id: string) {
  return `https://fartlabs.org/.well-known/genid/${id}`;
}

function formatTimestamp() {
  return new Date().toISOString();
}

function kvKeyTurtle(id: string) {
  return ["graphs", id, "turtle"];
}

function kvKeyOrama(id: string) {
  return ["graphs", id, "orama"];
}
