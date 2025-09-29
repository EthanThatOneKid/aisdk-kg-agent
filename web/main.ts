// TODO: Ingest text, visualize personal knowledge graph.
import { route } from "@std/http/unstable-route";
import { EntityLinker as _EntityLinker } from "agents/linker/entity-linker.ts";
import { TurtleGenerator as _TurtleGenerator } from "agents/turtle/generator.ts";
import { OramaSearchService as _OramaSearchService } from "agents/linker/search/orama/search.ts";
import { GreedyDisambiguator as _GreedyDisambiguator } from "agents/linker/disambiguator/greedy/disambiguator.ts";
import indexHtml from "./index.html" with { type: "text" };

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
        pattern: new URLPattern({ pathname: "/api/v1/graphs" }),
        handler: (_request: Request) => {
          //   const token = parseToken(request);
          //   const searchService = new OramaSearchService(orama);
          //   const disambiguationService = new GreedyDisambiguator(() =>
          //     genid(crypto.randomUUID())
          //   );
          //   const entityLinker = new EntityLinker(
          //     searchService,
          //     disambiguationService,
          //   );
          //   const generator = new TurtleGenerator(entityLinker);
          return Response.json({ message: "Not found" }, { status: 404 });
        },
      },
    ],
    () => Response.json({ message: "Not found" }, { status: 404 }),
  ),
} satisfies Deno.ServeDefaultExport;

function _parseToken(request: Request) {
  const authorizationString = request.headers.get("Authorization");
  if (!authorizationString) {
    throw new Error("Unauthorized");
  }

  return authorizationString.replace(/^Bearer\s+/, "");
}

function _genid(id: string) {
  return `https://fartlabs.org/.well-known/genid/${id}`;
}
