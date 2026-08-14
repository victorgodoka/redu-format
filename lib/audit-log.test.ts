import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { listAuditActors, listAuditLog, recordAction, resetAuditLog } from "./audit-log.ts";

beforeEach(resetAuditLog);

test.after(teardownTestDb);

const entry = (over: Partial<Parameters<typeof recordAction>[0]> = {}) => ({
  actorId: "111",
  actorUsername: "modone",
  actorDisplayName: "Mod One",
  action: "tournament.create" as const,
  target: "wind-up-cup-xi",
  detail: "Created tournament",
  ...over,
});

test("records an entry and lists it back, most recent first", async () => {
  await recordAction(entry({ detail: "first" }));
  await recordAction(entry({ detail: "second" }));

  const { items, total } = await listAuditLog();
  assert.equal(total, 2);
  assert.equal(items[0].detail, "second");
  assert.equal(items[1].detail, "first");
  assert.ok(items[0].id);
  assert.ok(items[0].at);
});

test("actor filter narrows to that actor only", async () => {
  await recordAction(entry({ actorId: "111", actorUsername: "modone" }));
  await recordAction(entry({ actorId: "222", actorUsername: "modtwo" }));

  const { items, total } = await listAuditLog({ actor: "222" });
  assert.equal(total, 1);
  assert.equal(items[0].actorId, "222");
});

test("action filter narrows to that action only", async () => {
  await recordAction(entry({ action: "tournament.create" }));
  await recordAction(entry({ action: "tournament.delete" }));

  const { items, total } = await listAuditLog({ action: "tournament.delete" });
  assert.equal(total, 1);
  assert.equal(items[0].action, "tournament.delete");
});

test("target filter narrows to that target only", async () => {
  await recordAction(entry({ target: "wind-up-cup-xi" }));
  await recordAction(entry({ target: "gear-gigant-open" }));

  const { items, total } = await listAuditLog({ target: "gear-gigant-open" });
  assert.equal(total, 1);
  assert.equal(items[0].target, "gear-gigant-open");
});

test("pagination splits into pages without dropping entries", async () => {
  for (let i = 0; i < 30; i++) {
    await recordAction(entry({ detail: `entry ${i}` }));
  }

  const pageOne = await listAuditLog();
  assert.equal(pageOne.total, 30);
  assert.equal(pageOne.pages, 2);
  assert.equal(pageOne.items.length, 25);

  const pageTwo = await listAuditLog({ page: "2" });
  assert.equal(pageTwo.items.length, 5);
});

test("an out-of-range page lands on the last real page", async () => {
  await recordAction(entry());

  const { page } = await listAuditLog({ page: "99" });
  assert.equal(page, 1);
});

test("listAuditActors returns each actor once, even with repeated entries", async () => {
  await recordAction(entry({ actorId: "111", actorUsername: "modone", actorDisplayName: "Mod One" }));
  await recordAction(entry({ actorId: "111", actorUsername: "modone", actorDisplayName: "Mod One" }));
  await recordAction(entry({ actorId: "222", actorUsername: "modtwo", actorDisplayName: "Mod Two" }));

  const actors = await listAuditActors();
  assert.equal(actors.length, 2);
  assert.ok(actors.some((a) => a.id === "111"));
  assert.ok(actors.some((a) => a.id === "222"));
});
