import assert from "node:assert/strict";
import test from "node:test";
import {
  VIDEO_MODELS,
  VIDEO_TEMPLATE_IDS,
  isVideoHighlight,
  videoTemplates,
} from "@repo/app-config/video";
import { getVideoTemplate, templateMediaUrl } from "../config";

// Seedance 2.0 rejects prompts over 4000 characters; appearance notes add up to ~360 (3 x 80 + framing).
const PROMPT_LIMIT = 4000 - 360;

test("every highlight render has its own clip, soundtrack and prompt", () => {
  for (const templateId of VIDEO_TEMPLATE_IDS) {
    const full = getVideoTemplate(templateId, "seedance-2.5");
    for (const model of VIDEO_MODELS) {
      if (!isVideoHighlight(templateId, model)) continue;
      const highlight = getVideoTemplate(templateId, model);
      const label = `${templateId} ${model}`;
      assert.notEqual(highlight.referenceVideoPath, full.referenceVideoPath, label);
      assert.notEqual(highlight.soundtrackPath, full.soundtrackPath, label);
      assert.notEqual(highlight.buildPrompt(3), full.buildPrompt(3), label);
    }
  }
});

test("every prompt stays under the provider's length cap for every photo count", () => {
  for (const templateId of VIDEO_TEMPLATE_IDS) {
    for (const model of VIDEO_MODELS) {
      const template = getVideoTemplate(templateId, model);
      for (let photos = 1; photos <= videoTemplates[templateId].slots.length; photos++) {
        const length = template.buildPrompt(photos).length;
        assert.ok(length <= PROMPT_LIMIT, `${templateId} ${model}: ${length} chars`);
      }
    }
  }
});

test("prompts cast exactly the uploaded photos", () => {
  const squad = getVideoTemplate("squad_walk", "seedance-2.5");
  assert.ok(squad.buildPrompt(1).includes("@图片1"));
  assert.ok(!squad.buildPrompt(1).includes("@图片2"));
  assert.ok(squad.buildPrompt(3).includes("@图片3"));
});

test("template media resolves against TEMPLATE_MEDIA_BASE_URL", () => {
  const env = { TEMPLATE_MEDIA_BASE_URL: "https://media.example.com/" };
  assert.equal(
    templateMediaUrl(env, "templates/duo_dance/reference.mp4"),
    "https://media.example.com/templates/duo_dance/reference.mp4",
  );
  assert.equal(
    templateMediaUrl(env, "https://cdn.example.com/a.mp4"),
    "https://cdn.example.com/a.mp4",
  );
  assert.equal(templateMediaUrl({ TEMPLATE_MEDIA_BASE_URL: "" }, "a.mp4"), null);
});
