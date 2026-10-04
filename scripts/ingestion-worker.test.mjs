import assert from "node:assert/strict";
import test from "node:test";

import { shouldQueueMaintenance } from "./ingestion-worker.mjs";

test("burst mode refreshes the queue when no fetch lease is available", () => {
  assert.equal(
    shouldQueueMaintenance({
      burstMode: true,
      lastMaintenanceAtMs: 0,
      nowMs: 10_000,
      maintenanceIntervalMs: 60_000,
      fetchLeaseCount: 0,
    }),
    true,
  );
});

test("steady mode still refills the queue when no fetch tasks are due", () => {
  assert.equal(
    shouldQueueMaintenance({
      burstMode: false,
      lastMaintenanceAtMs: 0,
      nowMs: 10_000,
      maintenanceIntervalMs: 60_000,
      fetchLeaseCount: 0,
    }),
    true,
  );
});

test("burst mode does not repeat maintenance immediately after a refill", () => {
  assert.equal(
    shouldQueueMaintenance({
      burstMode: true,
      lastMaintenanceAtMs: 10_000,
      nowMs: 20_000,
      maintenanceIntervalMs: 60_000,
      fetchLeaseCount: 0,
    }),
    false,
  );
});

test("burst mode prioritizes existing fetch leases over maintenance", () => {
  assert.equal(
    shouldQueueMaintenance({
      burstMode: true,
      lastMaintenanceAtMs: 0,
      nowMs: 20_000,
      maintenanceIntervalMs: 60_000,
      fetchLeaseCount: 1,
    }),
    false,
  );
});
