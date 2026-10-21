import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkTemplateGuides, guideSlug, readTemplateIds } from "../blog-guides.mjs";

const VIDEO_CONFIG = resolve(
  fileURLToPath(new URL("../../../../packages/app-config/src/video.ts", import.meta.url)),
);
const IDS = ["duo_dance", "solo_spotlight"];

test("template ids are read from app-config", () => {
  const ids = readTemplateIds(VIDEO_CONFIG);
  assert.ok(ids.length > 0);
  for (const id of ids) assert.match(id, /^[a-z0-9_]+$/);
});

test("guide slugs follow how-to-make-<template slug>", () => {
  assert.equal(guideSlug("duo_dance"), "how-to-make-duo-dance");
});

test("a paired guide passes; templates without one only warn", () => {
  const { errors, warnings } = checkTemplateGuides(
    [
      { slug: "how-to-make-duo-dance", template: "duo_dance" },
      { slug: "photo-tips", template: undefined },
    ],
    IDS,
  );
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"solo_spotlight" has no guide/);
});

test("an unknown template fails", () => {
  const { errors } = checkTemplateGuides([{ slug: "how-to-make-x", template: "nope" }], IDS);
  assert.match(errors.join("\n"), /unknown template "nope"/);
});

test("two guides for one template fail; an off-convention slug warns", () => {
  const { errors, warnings } = checkTemplateGuides(
    [
      { slug: "how-to-make-duo-dance", template: "duo_dance" },
      { slug: "duo-dance-tips", template: "duo_dance" },
      { slug: "spotlight-guide", template: "solo_spotlight" },
    ],
    IDS,
  );
  assert.match(errors.join("\n"), /both pair with template "duo_dance"/);
  assert.match(warnings.join("\n"), /name it how-to-make-solo-spotlight/);
});
