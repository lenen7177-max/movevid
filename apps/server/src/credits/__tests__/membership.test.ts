import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionMonthIndex } from "../application/membership";

const at = (iso: string) => new Date(iso);

test("the first subscription month runs until the same day next month", () => {
  const start = at("2026-01-06T10:00:00Z");
  assert.equal(subscriptionMonthIndex(start, at("2026-01-06T10:00:00Z")), 0);
  // The 1st of the next calendar month is still inside the first paid month.
  assert.equal(subscriptionMonthIndex(start, at("2026-02-01T00:00:00Z")), 0);
  assert.equal(subscriptionMonthIndex(start, at("2026-02-06T09:59:59Z")), 0);
  assert.equal(subscriptionMonthIndex(start, at("2026-02-06T10:00:00Z")), 1);
  assert.equal(subscriptionMonthIndex(start, at("2027-01-06T10:00:00Z")), 12);
});

test("an anchor on the 31st falls back to the end of shorter months", () => {
  const start = at("2026-01-31T12:00:00Z");
  assert.equal(subscriptionMonthIndex(start, at("2026-02-27T12:00:00Z")), 0);
  assert.equal(subscriptionMonthIndex(start, at("2026-02-28T12:00:00Z")), 1);
  assert.equal(subscriptionMonthIndex(start, at("2026-03-31T12:00:00Z")), 2);
});

test("a start date in the future never yields a negative month", () => {
  assert.equal(subscriptionMonthIndex(at("2026-05-01T00:00:00Z"), at("2026-04-01T00:00:00Z")), 0);
});
