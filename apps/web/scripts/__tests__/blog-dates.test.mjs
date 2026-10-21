import assert from "node:assert/strict";
import test from "node:test";
import { frontmatterDates, isIsoDay, lastModifiedDay, updatedDateErrors } from "../blog-dates.mjs";

test("days must be real YYYY-MM-DD dates", () => {
  assert.equal(isIsoDay("2026-10-20"), true);
  assert.equal(isIsoDay("2026-02-30"), false);
  assert.equal(isIsoDay("2026-1-5"), false);
  assert.equal(isIsoDay("2026-10-20T00:00:00Z"), false);
  assert.equal(isIsoDay(undefined), false);
});

test("updated is optional, well-formed and not before date", () => {
  assert.deepEqual(updatedDateErrors({ date: "2026-01-01" }), []);
  assert.deepEqual(updatedDateErrors({ date: "2026-01-01", updated: "2026-01-01" }), []);
  assert.deepEqual(updatedDateErrors({ date: "2026-01-01", updated: "2026-03-15" }), []);
  assert.match(updatedDateErrors({ date: "2026-01-01", updated: "15/03/2026" })[0], /YYYY-MM-DD/);
  assert.match(updatedDateErrors({ date: "2026-01-01", updated: "" })[0], /invalid updated/);
  assert.match(
    updatedDateErrors({ date: "2026-03-15", updated: "2026-01-01" })[0],
    /updated 2026-01-01 before its date 2026-03-15/,
  );
});

test("frontmatter dates are read from the frontmatter only", () => {
  const source = `---
title: "Guide"
date: "2026-01-01"
updated: '2026-02-01' # new section on lighting
---

date: 1999-01-01 in the body is not frontmatter
`;
  const dates = frontmatterDates(source);
  assert.deepEqual(dates, { date: "2026-01-01", updated: "2026-02-01" });
  assert.equal(lastModifiedDay(dates), "2026-02-01");
  const unchanged = frontmatterDates('---\ndate: "2026-01-01"\n---\nupdated: 2027-01-01\n');
  assert.deepEqual(unchanged, { date: "2026-01-01", updated: undefined });
  assert.equal(lastModifiedDay(unchanged), "2026-01-01");
  assert.deepEqual(frontmatterDates("no frontmatter"), { date: undefined, updated: undefined });
});
