import assert from "node:assert/strict";
import test from "node:test";
import { mapScheduleSlot } from "./db.mjs";
import { buildScheduleAdminPage } from "./server.mjs";

test("keeps schedule slot dates as plain YYYY-MM-DD strings without timezone shift", () => {
  const july15Slot = mapScheduleSlot({
    id: 15,
    slot_date: "2026-07-15",
    slot_time: "17:00",
    status: "available",
    created_at: new Date("2026-07-09T12:00:00+03:00"),
  });
  const july16Slot = mapScheduleSlot({
    id: 16,
    slot_date: "2026-07-16",
    slot_time: "18:30",
    status: "available",
    created_at: new Date("2026-07-09T12:00:00+03:00"),
  });

  assert.equal(july15Slot.date, "2026-07-15");
  assert.equal(july15Slot.label, "Среда, 15 июля, 17:00");
  assert.equal(july16Slot.date, "2026-07-16");
  assert.equal(july16Slot.label, "Четверг, 16 июля, 18:30");

  const adminHtml = buildScheduleAdminPage({
    slots: [july15Slot, july16Slot],
    trialBookings: [],
    applications: [],
  });

  assert.match(adminHtml, /15 июля 2026/);
  assert.match(adminHtml, /16 июля 2026/);
  assert.doesNotMatch(adminHtml, /14 июля 2026/);
});
