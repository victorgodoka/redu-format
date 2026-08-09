import assert from "node:assert/strict";
import test from "node:test";
import { safeNext } from "./safe-next.ts";

test("keeps same-origin paths", () => {
  for (const ok of [
    "/dashboard",
    "/events/wind-up-cup-xi/signup",
    "/events?structure=mixed&page=2",
    "/banlist#forbidden",
  ]) {
    assert.equal(safeNext(ok), ok);
  }
});

test("refuses anything that leaves the origin", () => {
  const attacks = [
    "https://evil.example",
    "http://evil.example/path",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "data:text/html,<script>",
    "dashboard",
    "",
    "   ",
  ];

  for (const attack of attacks) {
    assert.equal(safeNext(attack), "/dashboard", `allowed: ${attack}`);
  }
});

test("refuses control characters used to smuggle headers", () => {
  assert.equal(safeNext("/events\nLocation: https://evil.example"), "/dashboard");
  assert.equal(safeNext("/events\r\nSet-Cookie: a=b"), "/dashboard");
  assert.equal(safeNext("/events\u0000"), "/dashboard");
});

test("refuses non-strings and absurd lengths", () => {
  for (const bad of [null, undefined, 7, {}, [], "/" + "a".repeat(600)]) {
    assert.equal(safeNext(bad), "/dashboard");
  }
});

test("honours a custom fallback", () => {
  assert.equal(safeNext("https://evil.example", "/events"), "/events");
});
