import test from "node:test";
import assert from "node:assert/strict";
import { createWriteQueue } from "../src/lib/write-queue.ts";
test("overlapping writes run in order and a failed write does not block later work", async () => {
  const enqueue = createWriteQueue(),
    events: string[] = [];
  const first = enqueue(async () => {
    events.push("first");
    await new Promise((r) => setTimeout(r, 5));
    events.push("end");
  });
  const failed = enqueue(async () => {
    events.push("failed");
    throw Error("fail");
  });
  const last = enqueue(async () => events.push("last"));
  await first;
  await assert.rejects(failed);
  await last;
  assert.deepEqual(events, ["first", "end", "failed", "last"]);
});
