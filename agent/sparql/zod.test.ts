import { assert, assertEquals } from "@std/assert";
import { z } from "zod";
import { sparqlSchema } from "./zod.ts";

Deno.test("SPARQL Zod Integration", async (t) => {
  await t.step("validates correct SPARQL queries", () => {
    const validQueries = [
      "SELECT * WHERE { ?s ?p ?o }",
      "ASK WHERE { ?s ?p ?o }",
      "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }",
      "DESCRIBE ?s WHERE { ?s ?p ?o }",
    ];

    for (const query of validQueries) {
      const result = sparqlSchema.safeParse(query);
      assert(result.success, `Query should be valid: ${query}`);
      if (result.success) {
        assertEquals(result.data, query);
      }
    }
  });

  await t.step("rejects empty queries", () => {
    const result = sparqlSchema.safeParse("");
    assert(!result.success);
    if (!result.success) {
      assert(result.error.issues.length > 0);
      const hasEmptyError = result.error.issues.some((issue) =>
        issue.message.includes("Empty SPARQL query")
      );
      assert(hasEmptyError, "Should have empty query error");
    }
  });

  await t.step("rejects invalid SPARQL syntax", () => {
    const invalidQueries = [
      "INVALID QUERY",
      "SELECT * WHERE { ?s ?p ?o", // Missing closing brace
      "SELECT * WHERE ?s ?p ?o }", // Missing opening brace
    ];

    for (const query of invalidQueries) {
      const result = sparqlSchema.safeParse(query);
      assert(!result.success, `Query should be invalid: ${query}`);
      if (!result.success) {
        assert(result.error.issues.length > 0);
        // Check that we get SPARQL parsing errors
        const hasSparqlError = result.error.issues.some((issue) =>
          issue.message.includes("SPARQL parsing error") ||
          issue.message.includes("SPARQL expression error")
        );
        assert(hasSparqlError, `Should have SPARQL error for: ${query}`);
      }
    }
  });

  await t.step("rejects queries with malformed patterns", () => {
    const invalidQueries = [
      "SELECT * WHERE { ?s ?p }", // Missing object
      "SELECT * WHERE { ?s ?o }", // Missing predicate
      "SELECT * WHERE { ?p ?o }", // Missing subject
    ];

    for (const query of invalidQueries) {
      const result = sparqlSchema.safeParse(query);
      assert(!result.success, `Query should be invalid: ${query}`);
      if (!result.success) {
        assert(result.error.issues.length > 0);
        const hasSparqlError = result.error.issues.some((issue) =>
          issue.message.includes("SPARQL parsing error")
        );
        assert(hasSparqlError, `Should have SPARQL error for: ${query}`);
      }
    }
  });

  await t.step("rejects queries with invalid GROUP BY variables", () => {
    const query = "SELECT ?s WHERE { ?s ?p ?o } GROUP BY ?nonexistent";
    const result = sparqlSchema.safeParse(query);

    assert(!result.success, "Query should be invalid");
    if (!result.success) {
      assert(result.error.issues.length > 0);
      const hasGroupByError = result.error.issues.some((issue) =>
        issue.message.includes("Projection of ungrouped variable") ||
        issue.message.includes("SPARQL parsing error")
      );
      assert(hasGroupByError, "Should have GROUP BY error");
    }
  });

  await t.step("handles complex valid queries", () => {
    const complexQuery = `
      PREFIX ex: <http://example.org/>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?s ?name WHERE {
        ?s rdf:type ex:Person .
        ?s ex:name ?name .
        OPTIONAL {
          ?s ex:age ?age .
          FILTER(?age > 18)
        }
      }
      ORDER BY ?name
      LIMIT 10
    `;

    const result = sparqlSchema.safeParse(complexQuery);
    assert(result.success, "Complex query should be valid");
    if (result.success) {
      assertEquals(result.data, complexQuery);
    }
  });

  await t.step("provides detailed error messages", () => {
    const query = "SELECT * WHERE { ?s ?p ?o } GROUP BY ?nonexistent";
    const result = sparqlSchema.safeParse(query);

    assert(!result.success);
    if (!result.success) {
      // Should have specific error messages
      const errorMessages = result.error.issues.map((err) => err.message);
      assert(errorMessages.length > 0);

      // Should have detailed SPARQL error messages
      const hasDetailedError = result.error.issues.some((err) =>
        err.message.includes("Projection of ungrouped variable") ||
        err.message.includes("SPARQL parsing error")
      );
      assert(hasDetailedError, "Should have detailed error messages");
    }
  });

  await t.step("handles multiple validation errors", () => {
    // This test ensures that if there were multiple errors, they would all be reported
    const query = "INVALID QUERY WITH MULTIPLE ISSUES";
    const result = sparqlSchema.safeParse(query);

    assert(!result.success);
    if (!result.success) {
      // Should have at least one error
      assert(result.error.issues.length > 0);

      // All errors should be custom errors (not built-in Zod errors)
      const allCustomErrors = result.error.issues.every((err) =>
        err.code === z.ZodIssueCode.custom
      );
      assertEquals(
        allCustomErrors,
        true,
        "All errors should be custom SPARQL errors",
      );
    }
  });

  await t.step("validates queries with prefixes and literals", () => {
    const queryWithPrefixes = `
      PREFIX ex: <http://example.org/>
      SELECT ?s WHERE {
        ?s ex:name "John" .
        ?s ex:age 25 .
        ?s ex:active true
      }
    `;

    const result = sparqlSchema.safeParse(queryWithPrefixes);
    assertEquals(
      result.success,
      true,
      "Query with prefixes and literals should be valid",
    );
  });

  await t.step("validates queries with blank nodes", () => {
    const queryWithBlankNodes = `
      SELECT ?s WHERE {
        ?s ?p _:blankNode .
        _:blankNode ?p2 ?o
      }
    `;

    const result = sparqlSchema.safeParse(queryWithBlankNodes);
    assertEquals(
      result.success,
      true,
      "Query with blank nodes should be valid",
    );
  });

  await t.step("simple schema validation", () => {
    // Test the simple string schema
    const validQuery = "SELECT * WHERE { ?s ?p ?o }";
    const invalidQuery = "INVALID QUERY";

    const validResult = sparqlSchema.safeParse(validQuery);
    const invalidResult = sparqlSchema.safeParse(invalidQuery);

    assertEquals(
      validResult.success,
      true,
      "Valid query should pass simple schema",
    );
    assertEquals(
      invalidResult.success,
      false,
      "Invalid query should fail simple schema",
    );

    if (!invalidResult.success) {
      // Should have detailed SPARQL parsing error
      const hasSparqlError = invalidResult.error.issues.some((issue) =>
        issue.message.includes("SPARQL parsing error")
      );
      assert(hasSparqlError, "Should have detailed SPARQL error");
    }
  });
});
