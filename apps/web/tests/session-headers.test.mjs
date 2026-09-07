import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionHeaders } from "../app/session-headers.ts";

test("public shares tolerate inaccessible session storage and invalid session shapes", () => {
  assert.deepEqual(sessionHeaders({ getItem() { throw new Error("storage disabled"); } }), {});
  for (const session of [null, {}, { accessToken: 42, expiresAt: "2099-01-01" }, { accessToken: "token" }, { accessToken: "", expiresAt: "2099-01-01" }, { accessToken: "token", expiresAt: "invalid date" }]) {
    assert.deepEqual(sessionHeaders({ getItem: () => JSON.stringify(session) }), {});
  }
  for (const accessToken of ["bad\ntoken", " token ", "Bearer token"]) {
    assert.deepEqual(sessionHeaders({ getItem: () => JSON.stringify({ accessToken, expiresAt: "2099-01-01" }) }), {});
  }
});
