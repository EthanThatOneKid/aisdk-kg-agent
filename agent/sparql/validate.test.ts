import { assert, assertEquals } from "@std/assert";
import { validateSparql } from "./validate.ts";

Deno.test("validateSparql", async (t) => {
  await t.step("validates correct SELECT queries", () => {
    const validQueries = [
      "SELECT * WHERE { ?s ?p ?o }",
      "SELECT ?s ?p WHERE { ?s ?p ?o }",
      "SELECT DISTINCT ?s WHERE { ?s ?p ?o }",
      "SELECT ?s WHERE { ?s ?p ?o . ?s ?p2 ?o2 }",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("validates correct ASK queries", () => {
    const validQueries = [
      "ASK WHERE { ?s ?p ?o }",
      "ASK WHERE { ?s ?p ?o . ?s ?p2 ?o2 }",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("validates correct CONSTRUCT queries", () => {
    const validQueries = [
      "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }",
      "CONSTRUCT { ?s ?p ?o . ?s ?p2 ?o2 } WHERE { ?s ?p ?o . ?s ?p2 ?o2 }",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("validates correct DESCRIBE queries", () => {
    const validQueries = [
      "DESCRIBE ?s WHERE { ?s ?p ?o }",
      "DESCRIBE <http://example.org/resource>",
      "DESCRIBE ?s ?o WHERE { ?s ?p ?o }",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("validates queries with FILTER clauses", () => {
    const validQueries = [
      "SELECT * WHERE { ?s ?p ?o FILTER(?o > 10) }",
      "SELECT * WHERE { ?s ?p ?o FILTER(lang(?o) = 'en') }",
      "SELECT * WHERE { ?s ?p ?o FILTER(regex(?o, 'test')) }",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("validates queries with OPTIONAL clauses", () => {
    const validQueries = [
      "SELECT * WHERE { ?s ?p ?o OPTIONAL { ?s ?p2 ?o2 } }",
      "SELECT * WHERE { ?s ?p ?o OPTIONAL { ?s ?p2 ?o2 } OPTIONAL { ?s ?p3 ?o3 } }",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("validates queries with UNION patterns", () => {
    const validQueries = [
      "SELECT * WHERE { { ?s ?p ?o } UNION { ?s ?p2 ?o2 } }",
      "SELECT * WHERE { { ?s ?p ?o } UNION { ?s ?p2 ?o2 } UNION { ?s ?p3 ?o3 } }",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("validates queries with ORDER BY", () => {
    const validQueries = [
      "SELECT * WHERE { ?s ?p ?o } ORDER BY ?s",
      "SELECT * WHERE { ?s ?p ?o } ORDER BY ASC(?s) DESC(?o)",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("validates queries with GROUP BY", () => {
    const validQueries = [
      "SELECT ?s (COUNT(?o) AS ?count) WHERE { ?s ?p ?o } GROUP BY ?s",
      "SELECT ?s ?p (COUNT(?o) AS ?count) WHERE { ?s ?p ?o } GROUP BY ?s ?p",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("validates queries with LIMIT and OFFSET", () => {
    const validQueries = [
      "SELECT * WHERE { ?s ?p ?o } LIMIT 10",
      "SELECT * WHERE { ?s ?p ?o } OFFSET 5",
      "SELECT * WHERE { ?s ?p ?o } LIMIT 10 OFFSET 5",
    ];

    for (const query of validQueries) {
      const result = validateSparql(query);
      assert(result.isValid, `Query should be valid: ${query}`);
      assertEquals(
        result.errors.length,
        0,
        `Query should have no errors: ${query}`,
      );
    }
  });

  await t.step("rejects invalid SPARQL syntax", () => {
    const invalidQueries = [
      "INVALID QUERY",
      "SELECT * WHERE { ?s ?p ?o", // Missing closing brace
      "SELECT * WHERE ?s ?p ?o }", // Missing opening brace
      "SELECT * WHERE { ?s ?p ?o } INVALID",
      "SELECT * WHERE { ?s ?p ?o } ORDER BY INVALID",
    ];

    for (const query of invalidQueries) {
      const result = validateSparql(query);
      assertEquals(result.isValid, false, `Query should be invalid: ${query}`);
      assertEquals(
        result.errors.length > 0,
        true,
        `Query should have errors: ${query}`,
      );
    }
  });

  await t.step("rejects empty queries", () => {
    const result = validateSparql("");
    assertEquals(result.isValid, false);
    assert(result.errors.length > 0);
  });

  await t.step("rejects queries with malformed patterns", () => {
    const invalidQueries = [
      "SELECT * WHERE { ?s ?p }", // Missing object
      "SELECT * WHERE { ?s ?o }", // Missing predicate
      "SELECT * WHERE { ?p ?o }", // Missing subject
    ];

    for (const query of invalidQueries) {
      const result = validateSparql(query);
      assertEquals(result.isValid, false, `Query should be invalid: ${query}`);
      assertEquals(
        result.errors.length > 0,
        true,
        `Query should have errors: ${query}`,
      );
    }
  });

  await t.step("rejects queries with invalid FILTER syntax", () => {
    const invalidQueries = [
      "SELECT * WHERE { ?s ?p ?o FILTER }", // Missing filter expression
      "SELECT * WHERE { ?s ?p ?o FILTER( }", // Unclosed parentheses
      "SELECT * WHERE { ?s ?p ?o FILTER) }", // Unopened parentheses
    ];

    for (const query of invalidQueries) {
      const result = validateSparql(query);
      assertEquals(result.isValid, false, `Query should be invalid: ${query}`);
      assertEquals(
        result.errors.length > 0,
        true,
        `Query should have errors: ${query}`,
      );
    }
  });

  await t.step("rejects queries with invalid GROUP BY variables", () => {
    const invalidQueries = [
      "SELECT ?s WHERE { ?s ?p ?o } GROUP BY ?nonexistent", // Variable not in scope
    ];

    for (const query of invalidQueries) {
      const result = validateSparql(query);
      assertEquals(result.isValid, false, `Query should be invalid: ${query}`);
      assertEquals(
        result.errors.length > 0,
        true,
        `Query should have errors: ${query}`,
      );
    }
  });

  await t.step(
    "handles queries with ORDER BY variables (parser is lenient)",
    () => {
      // Note: The SPARQL parser is lenient with ORDER BY variable scope
      const query = "SELECT ?s WHERE { ?s ?p ?o } ORDER BY ?nonexistent";
      const result = validateSparql(query);
      // The parser accepts this query even though it has an invalid variable reference
      assertEquals(
        result.isValid,
        true,
        "Query should be valid (parser is lenient)",
      );
      assertEquals(result.errors.length, 0, "Query should have no errors");
    },
  );

  await t.step("handles complex nested queries", () => {
    const complexQuery = `
      SELECT ?s ?p ?o WHERE {
        ?s ?p ?o .
        OPTIONAL {
          ?s ?p2 ?o2 .
          FILTER(?o2 > 10)
        }
        FILTER(?o < 100)
      }
      ORDER BY ?s
      LIMIT 50
    `;

    const result = validateSparql(complexQuery);
    assert(result.isValid, "Complex query should be valid");
    assertEquals(
      result.errors.length,
      0,
      "Complex query should have no errors",
    );
  });

  await t.step("handles queries with prefixes", () => {
    const queryWithPrefixes = `
      PREFIX ex: <http://example.org/>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?s WHERE {
        ?s rdf:type ex:Person .
        ?s ex:name ?name
      }
    `;

    const result = validateSparql(queryWithPrefixes);
    assert(result.isValid, "Query with prefixes should be valid");
    assertEquals(
      result.errors.length,
      0,
      "Query with prefixes should have no errors",
    );
  });

  await t.step("handles queries with blank nodes", () => {
    const queryWithBlankNodes = `
      SELECT ?s WHERE {
        ?s ?p _:blankNode .
        _:blankNode ?p2 ?o
      }
    `;

    const result = validateSparql(queryWithBlankNodes);
    assertEquals(
      result.isValid,
      true,
      "Query with blank nodes should be valid",
    );
    assertEquals(
      result.errors.length,
      0,
      "Query with blank nodes should have no errors",
    );
  });

  await t.step("handles queries with literals", () => {
    const queryWithLiterals = `
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      SELECT ?s WHERE {
        ?s ?p "string literal" .
        ?s ?p2 42 .
        ?s ?p3 3.14 .
        ?s ?p4 true .
        ?s ?p5 "typed literal"^^xsd:string
      }
    `;

    const result = validateSparql(queryWithLiterals);
    assert(result.isValid, "Query with literals should be valid");
    assertEquals(
      result.errors.length,
      0,
      "Query with literals should have no errors",
    );
  });
});
