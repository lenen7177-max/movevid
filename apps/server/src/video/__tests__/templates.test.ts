import assert from "node:assert/strict";
import test from "node:test";
import {
  VIDEO_MODELS,
  VIDEO_TEMPLATE_IDS,
  getVideoMinPhotos,
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
  for (const templateId of VIDEO_TEMPLATE_IDS) {
    for (const model of VIDEO_MODELS) {
      const template = getVideoTemplate(templateId, model);
      const slots = videoTemplates[templateId].slots.length;
      for (let photos = getVideoMinPhotos(templateId); photos <= slots; photos++) {
        const prompt = template.buildPrompt(photos);
        const label = `${templateId} ${model} with ${photos} photos`;
        for (let handle = 1; handle <= photos; handle++) {
          assert.ok(prompt.includes(`@图片${handle}`), `${label}: casts @图片${handle}`);
        }
        assert.ok(!prompt.includes(`@图片${photos + 1}`), `${label}: no @图片${photos + 1}`);
      }
    }
  }
});

test("every template's media resolves against TEMPLATE_MEDIA_BASE_URL", () => {
  const env = { TEMPLATE_MEDIA_BASE_URL: "https://media.example.com/" };
  for (const templateId of VIDEO_TEMPLATE_IDS) {
    const { referenceVideoPath } = getVideoTemplate(templateId, "seedance-2.5");
    assert.equal(
      templateMediaUrl(env, referenceVideoPath),
      `https://media.example.com/${referenceVideoPath}`,
    );
  }
  assert.equal(
    templateMediaUrl(env, "https://cdn.example.com/a.mp4"),
    "https://cdn.example.com/a.mp4",
  );
  assert.equal(templateMediaUrl({ TEMPLATE_MEDIA_BASE_URL: "" }, "a.mp4"), null);
});
