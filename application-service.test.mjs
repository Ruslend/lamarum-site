import assert from "node:assert/strict";
import test from "node:test";
import { submitApplication } from "./application-service.mjs";

test("keeps a saved application when Telegram notification fails", async () => {
  const events = [];
  const notificationError = new Error("Telegram is unavailable");

  const result = await submitApplication(
    { name: "Анна" },
    {
      save: async (data) => {
        events.push("saved");
        return { id: 42, ...data };
      },
      notify: async (application) => {
        events.push(`notify:${application.id}`);
        throw notificationError;
      },
      onNotificationError: (error, application) => {
        events.push(`logged:${application.id}:${error.message}`);
      },
    },
  );

  assert.deepEqual(result, { id: 42, name: "Анна" });
  assert.deepEqual(events, ["saved", "notify:42", "logged:42:Telegram is unavailable"]);
});

test("does not notify when saving the application fails", async () => {
  let notified = false;

  await assert.rejects(
    submitApplication(
      { name: "Анна" },
      {
        save: async () => {
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
