import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeCrash } from "../src/features/crash-privacy.ts";
test("crash reports remove note, identity, request and profile contents while retaining stack frames", () => {
  const event = sanitizeCrash({
    user: { id: "private" },
    request: { data: "note" },
    extra: { photo: "private" },
    contexts: { profile: { age: 40 } },
    breadcrumbs: ["secret"],
    exception: {
      values: [
        {
          value: "private drink text",
          stacktrace: {
            frames: [{ filename: "/Users/name/app.js?token=secret" }],
          },
        },
      ],
    },
  }) as Record<string, unknown>;
  assert.equal(event.user, undefined);
  assert.equal(event.contexts, undefined);
  assert.doesNotMatch(JSON.stringify(event), /private|secret|\/name\//);
  assert.match(JSON.stringify(event), /app.js/);
});
