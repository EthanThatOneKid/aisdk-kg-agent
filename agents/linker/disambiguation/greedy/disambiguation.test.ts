import { assertEquals, assertExists } from "@std/assert";
import { GreedyDisambiguationService } from "./disambiguation.ts";
import type {
  SearchHit,
  SearchResponse,
} from "agents/linker/search/service.ts";

Deno.test("GreedyDisambiguationService - constructor", () => {
  const service = new GreedyDisambiguationService();

  // Verify the service is created successfully.
  assertExists(service);
  assertEquals(typeof service.disambiguate, "function");
});

Deno.test("GreedyDisambiguationService - disambiguate with empty hits", async () => {
  const service = new GreedyDisambiguationService();

  // Test with empty hits array.
  const searchResponse: SearchResponse = {
    text: "test search",
    hits: [],
  };

  const result = await service.disambiguate(searchResponse);
  assertEquals(result, null);
});

Deno.test("GreedyDisambiguationService - disambiguate with single hit", async () => {
  const service = new GreedyDisambiguationService();

  // Test with single hit.
  const searchHit: SearchHit = {
    subject: "http://example.org/person1",
    score: 0.95,
  };

  const searchResponse: SearchResponse = {
    text: "Alice",
    hits: [searchHit],
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score, 0.95);
});

Deno.test("GreedyDisambiguationService - disambiguate with multiple hits", async () => {
  const service = new GreedyDisambiguationService();

  // Test with multiple hits - should return the first one (highest score).
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person1",
      score: 0.95,
    },
    {
      subject: "http://example.org/person2",
      score: 0.87,
    },
    {
      subject: "http://example.org/person3",
      score: 0.72,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "Alice",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score, 0.95);
});

Deno.test("GreedyDisambiguationService - disambiguate with zero scores", async () => {
  const service = new GreedyDisambiguationService();

  // Test with hits that have zero scores.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person1",
      score: 0.0,
    },
    {
      subject: "http://example.org/person2",
      score: 0.0,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "test",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score, 0.0);
});

Deno.test("GreedyDisambiguationService - disambiguate with negative scores", async () => {
  const service = new GreedyDisambiguationService();

  // Test with hits that have negative scores.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person1",
      score: -0.5,
    },
    {
      subject: "http://example.org/person2",
      score: -0.8,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "test",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score, -0.5);
});

Deno.test("GreedyDisambiguationService - disambiguate with very high scores", async () => {
  const service = new GreedyDisambiguationService();

  // Test with hits that have very high scores.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person1",
      score: 99.99,
    },
    {
      subject: "http://example.org/person2",
      score: 88.88,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "test",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score, 99.99);
});

Deno.test("GreedyDisambiguationService - disambiguate with identical scores", async () => {
  const service = new GreedyDisambiguationService();

  // Test with hits that have identical scores - should return the first one.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person1",
      score: 0.85,
    },
    {
      subject: "http://example.org/person2",
      score: 0.85,
    },
    {
      subject: "http://example.org/person3",
      score: 0.85,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "test",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score, 0.85);
});

Deno.test("GreedyDisambiguationService - disambiguate with mixed score types", async () => {
  const service = new GreedyDisambiguationService();

  // Test with hits that have mixed positive and negative scores.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person1",
      score: 0.5,
    },
    {
      subject: "http://example.org/person2",
      score: -0.3,
    },
    {
      subject: "http://example.org/person3",
      score: 0.0,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "test",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score, 0.5);
});

Deno.test("GreedyDisambiguationService - disambiguate with special characters in subjects", async () => {
  const service = new GreedyDisambiguationService();

  // Test with subjects containing special characters.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person#fragment",
      score: 0.9,
    },
    {
      subject: "http://example.org/person?query=value",
      score: 0.8,
    },
    {
      subject: "http://example.org/path/to/resource",
      score: 0.7,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "test",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person#fragment");
  assertEquals(result.score, 0.9);
});

Deno.test("GreedyDisambiguationService - disambiguate with long subjects", async () => {
  const service = new GreedyDisambiguationService();

  // Test with very long subject URIs.
  const longSubject =
    "http://example.org/very/long/path/to/a/resource/with/many/segments/and/parameters?param1=value1&param2=value2&param3=value3#fragment";

  const searchHits: SearchHit[] = [
    {
      subject: longSubject,
      score: 0.95,
    },
    {
      subject: "http://example.org/short",
      score: 0.85,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "test",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, longSubject);
  assertEquals(result.score, 0.95);
});

Deno.test("GreedyDisambiguationService - disambiguate with empty text", async () => {
  const service = new GreedyDisambiguationService();

  // Test with empty search text.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person1",
      score: 0.5,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score, 0.5);
});

Deno.test("GreedyDisambiguationService - disambiguate with whitespace text", async () => {
  const service = new GreedyDisambiguationService();

  // Test with whitespace-only search text.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person1",
      score: 0.3,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "   \t\n  ",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/person1");
  assertEquals(result.score, 0.3);
});

Deno.test("GreedyDisambiguationService - disambiguate with single element array", async () => {
  const service = new GreedyDisambiguationService();

  // Test with array containing only one element.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/unique",
      score: 0.42,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "unique",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);
  assertEquals(result.subject, "http://example.org/unique");
  assertEquals(result.score, 0.42);
});

Deno.test("GreedyDisambiguationService - disambiguate preserves original hit object", async () => {
  const service = new GreedyDisambiguationService();

  // Test that the returned hit is the exact same object reference.
  const searchHits: SearchHit[] = [
    {
      subject: "http://example.org/person1",
      score: 0.95,
    },
    {
      subject: "http://example.org/person2",
      score: 0.87,
    },
  ];

  const searchResponse: SearchResponse = {
    text: "test",
    hits: searchHits,
  };

  const result = await service.disambiguate(searchResponse);
  assertExists(result);

  // Verify it's the same object reference.
  assertEquals(result === searchHits[0], true);
  assertEquals(result === searchResponse.hits[0], true);
});
