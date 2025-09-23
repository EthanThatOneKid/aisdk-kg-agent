import type { LanguageModel, ModelMessage } from "ai";
import { Experimental_Agent as Agent } from "ai";
import { validateTurtle } from "./shacl/validate.ts";

interface GenerateTurtleContext {
  inputText: string;
  references: Array<[string, string]>;
  allowedPrefixes?: string[];
  timestamp?: string;
  maxRetries?: number;
  shaclShapes?: string;
}

const defaultAllowedPrefixes = [
  "rdf",
  "rdfs",
  "schema",
  "foaf",
  "xsd",
  "geo",
  "owl",
  "skos",
  "dc",
  "dcterms",
];

export async function generateTurtle(
  model: LanguageModel,
  context: GenerateTurtleContext,
): Promise<string> {
  const maxRetries = context.maxRetries ?? 3;
  const allowedPrefixes = context.allowedPrefixes ?? defaultAllowedPrefixes;
  const agent = new Agent({
    model,
    system: [
      "You are an expert episodic memory extractor for RDF knowledge graphs.",
      "Convert natural language into valid Turtle (TTL) using schema.org so that episodes (who/what/when/where) are faithfully captured.",
      "Always declare required prefixes at the top: rdf, schema, xsd (and only from the allowlist).",
      `Use only these prefixes: ${
        allowedPrefixes.join(", ")
      }. Do not introduce any others; expand to full IRIs instead.`,
      "Use the provided references to map surface strings to subject IRIs exactly; never change casing or structure of provided IRIs.",
      "Prefer schema.org vocabulary. Model activities using schema:Action (WatchAction, ListenAction, ReadAction, ViewAction, EatAction, DrinkAction, BuyAction, PayAction, OrderAction, CheckInAction, CommunicateAction, ReviewAction, CreateAction).",
      "For Actions capture: schema:agent, schema:object, schema:location, schema:actionStatus, schema:startTime/endTime, schema:instrument/result/recipient/participant when present.",
      "Use schema:Event (& subclasses) for happenings; link organizer/attendee/performer and use startDate/endDate.",
      "Use CreativeWork subclasses (Movie, TVEpisode, PodcastEpisode, Article, MusicRecording, VideoObject) for consumed/created items; Places (Restaurant, CafeOrCoffeeShop, BarOrPub, Park, LodgingBusiness) for venues.",
      "IRIs: Prefer named HTTP(S) IRIs only when explicitly provided in the input or references. Do NOT mint or invent any IRIs (no urn:, UUIDs, .well-known).",
      "Avoid blank nodes whenever possible — prefer named IRIs from references. If no IRI is provided, use literals (schema:name, schema:identifier). Use blank nodes only if required by validation.",
      'Time & units: Prefer typed literals with xsd (xsd:date, xsd:dateTime, xsd:decimal, xsd:duration). Normalize vague times only when clearly implied (e.g., "yesterday morning"). If a timestamp is provided separately, include it verbatim as a typed literal.',
      "Determinism: Reuse identical IRIs across triples; do not alias or paraphrase IRIs.",
      "Output contract: Only output valid Turtle. No prose, no code fences, no explanations.",
      "Final checklist: (1) No invented IRIs; (2) Use only allowlisted prefixes; (3) Map entities to provided IRIs via references; (4) Include agent/object/location/time/status when present; (5) Prefer schema.org Actions/Events/CreativeWorks/Places; (6) Use typed literals with xsd; (7) Prefer named nodes; (8) Ensure the Turtle parses.",
    ].join("\n"),
  });

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: "Kevin Bacon finished watching Footloose on March 1st, 2014.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#watch1> a schema:WatchAction;",
        "  schema:agent <#kevinBacon>;",
        "  schema:object <#footloose>;",
        "  schema:actionStatus schema:CompletedActionStatus;",
        '  schema:startTime "2014-03-01"^^xsd:date .',
        "",
        '<#kevinBacon> a schema:Person; schema:name "Kevin Bacon" .',
        '<#footloose> a schema:Movie; schema:name "Footloose" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "Alice read the article 'The Future of AI' yesterday.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#read1> a schema:ReadAction;",
        "  schema:agent <#alice>;",
        "  schema:object <#aiArticle>;",
        "  schema:actionStatus schema:CompletedActionStatus;",
        '  schema:startTime "2025-09-22"^^xsd:date .',
        "",
        '<#alice> a schema:Person; schema:name "Alice" .',
        '<#aiArticle> a schema:Article; schema:headline "The Future of AI" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "Maria ate dinner at Mama Mia's Pizza on May 5, 2024.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#eat1> a schema:EatAction;",
        "  schema:agent <#maria>;",
        "  schema:object <#mamaMias>;",
        '  schema:startTime "2024-05-05"^^xsd:date;',
        "  schema:actionStatus schema:CompletedActionStatus .",
        "",
        '<#maria> a schema:Person; schema:name "Maria" .',
        '<#mamaMias> a schema:Restaurant; schema:name "Mama Mia\'s Pizza" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "Tom drank a cappuccino at Central Cafe yesterday morning.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#drink1> a schema:DrinkAction;",
        "  schema:agent <#tom>;",
        "  schema:object <#cappuccino>;",
        "  schema:location <#centralCafe>;",
        '  schema:startTime "2025-09-22T09:00:00-07:00"^^xsd:dateTime;',
        "  schema:actionStatus schema:CompletedActionStatus .",
        "",
        '<#tom> a schema:Person; schema:name "Tom" .',
        '<#cappuccino> a schema:MenuItem; schema:name "Cappuccino" .',
        '<#centralCafe> a schema:CafeOrCoffeeShop; schema:name "Central Cafe" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "Bob paid $20 for his lunch.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#pay1> a schema:PayAction;",
        "  schema:agent <#bob>;",
        "  schema:object <#lunch>;",
        '  schema:price "20.00"^^xsd:decimal;',
        '  schema:priceCurrency "USD";',
        "  schema:actionStatus schema:CompletedActionStatus .",
        "",
        '<#bob> a schema:Person; schema:name "Bob" .',
        '<#lunch> a schema:MenuItem; schema:name "Lunch" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "Lisa checked into the Grand Hotel at 3pm on August 10, 2025.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#checkin1> a schema:CheckInAction;",
        "  schema:agent <#lisa>;",
        "  schema:location <#grandHotel>;",
        '  schema:startTime "2025-08-10T15:00:00-07:00"^^xsd:dateTime;',
        "  schema:actionStatus schema:CompletedActionStatus .",
        "",
        '<#lisa> a schema:Person; schema:name "Lisa" .',
        '<#grandHotel> a schema:LodgingBusiness; schema:name "Grand Hotel" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "Support sent John an email on March 2, 2025.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#email1> a schema:EmailAction;",
        "  schema:agent <#support>;",
        "  schema:recipient <#john>;",
        '  schema:startTime "2025-03-02"^^xsd:date;',
        "  schema:actionStatus schema:CompletedActionStatus .",
        "",
        '<#support> a schema:Organization; schema:name "Support" .',
        '<#john> a schema:Person; schema:name "John" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "Alex left a review for The Matrix on Feb 1, 2024.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#review1> a schema:ReviewAction;",
        "  schema:agent <#alex>;",
        "  schema:object <#matrix>;",
        '  schema:startTime "2024-02-01"^^xsd:date;',
        "  schema:actionStatus schema:CompletedActionStatus;",
        "  schema:result <#matrixReview> .",
        "",
        '<#alex> a schema:Person; schema:name "Alex" .',
        '<#matrix> a schema:Movie; schema:name "The Matrix" .',
        "<#matrixReview> a schema:Review .",
      ].join("\n"),
    },
    {
      role: "user",
      content: "City Arts Council hosts a free park concert on July 12, 2025.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#event1> a schema:MusicEvent;",
        '  schema:name "Summer Park Concert";',
        '  schema:startDate "2025-07-12T19:00:00-07:00"^^xsd:dateTime;',
        "  schema:location <#riversidePark>;",
        "  schema:organizer <#cityArts> .",
        "",
        '<#riversidePark> a schema:Park; schema:name "Riverside Park" .',
        '<#cityArts> a schema:Organization; schema:name "City Arts Council" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "The Warriors played a basketball game on May 1, 2025.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#game1> a schema:SportsEvent;",
        '  schema:name "Warriors Basketball Game";',
        '  schema:startDate "2025-05-01"^^xsd:date;',
        "  schema:performer <#warriors> .",
        "",
        '<#warriors> a schema:SportsTeam; schema:name "Warriors" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "John reserved flight UA123 from SFO to EWR on Oct 20, 2025.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#res1> a schema:FlightReservation;",
        '  schema:reservationId "FL123456";',
        "  schema:reservationStatus <https://schema.org/ReservationConfirmed>;",
        "  schema:underName <#johnSmith>;",
        "  schema:reservationFor <#flight1> .",
        "",
        '<#johnSmith> a schema:Person; schema:name "John Smith" .',
        "<#flight1> a schema:Flight;",
        '  schema:flightNumber "UA123";',
        "  schema:departureAirport <#sfo>;",
        "  schema:arrivalAirport <#ewr>;",
        '  schema:departureTime "2025-10-20T08:00:00-07:00"^^xsd:dateTime;',
        '  schema:arrivalTime "2025-10-20T16:00:00-04:00"^^xsd:dateTime .',
        "",
        '<#sfo> a schema:Airport; schema:iataCode "SFO" .',
        '<#ewr> a schema:Airport; schema:iataCode "EWR" .',
      ].join("\n"),
    },
    {
      role: "user",
      content: "A European trip covered Paris and Rome in June 2025.",
    },
    {
      role: "assistant",
      content: [
        "@prefix schema: <https://schema.org/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "<#trip1> a schema:Trip;",
        '  schema:name "European Adventure";',
        '  schema:departureTime "2025-06-01"^^xsd:date;',
        '  schema:arrivalTime "2025-06-15"^^xsd:date;',
        "  schema:itinerary <#paris>, <#rome> .",
        "",
        '<#paris> a schema:Place; schema:name "Paris, France" .',
        '<#rome> a schema:Place; schema:name "Rome, Italy" .',
      ].join("\n"),
    },
    {
      role: "user",
      content:
        "On the Tartine Bakery page, you can view it on the web at http://www.urbanspoon.com/r/6/92204 or in the Urbanspoon iOS app.",
    },
    { role: "user", content: context.inputText },
    {
      role: "user",
      content: [
        "Here are the references you can use to map the natural language to the Turtle:",
        ...context.references.map(([text, subject]) =>
          `- [${text}](${subject})`
        ),
      ].join("\n"),
    },
    ...((context.timestamp !== undefined
      ? [
        { role: "user", content: "Here is the timestamp:" },
        { role: "user", content: context.timestamp },
      ]
      : []) as ModelMessage[]),
    { role: "assistant", content: "Here is the Turtle:" },
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Attempt ${attempt}/${maxRetries} generating Turtle...`);
    const { text } = await agent.generate({ messages });
    const sanitized = trimFence(text.trim());
    // First, N3 syntax check via SHACL validator with no schema (it parses data).
    const syntaxRes = await validateTurtle({ graphText: sanitized });
    if (syntaxRes.isValid) {
      if (context.shaclShapes) {
        const shaclReport = await validateTurtle({
          graphText: sanitized,
          schemaText: context.shaclShapes,
        });
        if (shaclReport.isValid) {
          return sanitized;
        }

        const feedback = [
          "The previous Turtle output failed SHACL validation.",
          `Validation errors: ${shaclReport.errorText ?? "Unknown"}`,
          "Please correct the errors and re-output valid Turtle only.",
        ].join("\n\n");
        console.log("SHACL feedback:", feedback);

        messages.push(
          { role: "assistant", content: text },
          { role: "user", content: feedback },
        );
        continue;
      }

      return sanitized;
    }

    const feedback = [
      "The previous Turtle output was invalid.",
      `Parser error: ${syntaxRes.errorText ?? "Unknown"}`,
      "Please correct the errors and re-output valid Turtle only.",
    ].join("\n\n");
    console.log("Syntax feedback:", feedback);

    messages.push(
      { role: "assistant", content: text },
      { role: "user", content: feedback },
    );
  }

  throw new Error(
    `Failed to generate valid Turtle after ${maxRetries} attempts.`,
  );
}

function trimFence(text: string): string {
  const fenced = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (fenced) {
    return fenced[1].trim();
  }

  return text.replace(/```[a-zA-Z]*|```/g, "").trim();
}
