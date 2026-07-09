import assert from "node:assert/strict";
import test from "node:test";
import { submitTrialBooking } from "./booking-service.mjs";

test("keeps a saved trial booking when Telegram notification fails", async () => {
  const events = [];
  const notificationError = new Error("Telegram is unavailable");

  const result = await submitTrialBooking(
    { parentName: "Анна", studentName: "Илья" },
    {
      book: async (data) => {
        events.push("booked");
        return { id: 7, ...data };
      },
      notify: async (booking) => {
        events.push(`notify:${booking.id}`);
        throw notificationError;
      },
      onNotificationError: (error, booking) => {
        events.push(`logged:${booking.id}:${error.message}`);
      },
    },
  );

  assert.deepEqual(result, { id: 7, parentName: "Анна", studentName: "Илья" });
  assert.deepEqual(events, ["booked", "notify:7", "logged:7:Telegram is unavailable"]);
});

test("does not notify when creating the trial booking fails", async () => {
  let notified = false;

  await assert.rejects(
    submitTrialBooking(
      { parentName: "Анна" },
      {
        book: async () => {
          throw new Error("Database is unavailable");
        },
        notify: async () => {
          notified = true;
        },
      },
    ),
    /Database is unavailable/,
  );

  assert.equal(notified, false);
});
