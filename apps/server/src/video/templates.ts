import type { VideoTemplateId } from "@repo/app-config/video";
import { buildReferencePrompt, type ReferencePromptSpec } from "./prompt-builder";

/**
 * Server half of each template: its reference media and prompt.
 *
 * Media paths are relative to TEMPLATE_MEDIA_BASE_URL (or absolute URLs). The default layout is
 *   templates/<id>/reference.mp4             reference clip sent to Seedance (mp4, <=30s)
 *   templates/<id>/soundtrack.m4a            AAC soundtrack aligned to the clip from 0s
 *   templates/<id>/reference-highlight.mp4   shorter cut for Seedance 2.0 models (<=15s)
 *   templates/<id>/soundtrack-highlight.m4a  the soundtrack cut identically
 * The soundtrack is never sent to Seedance; browsers mux it into the finished render.
 *
 * The prompts below are working examples. Rewrite the shot list to match the cuts in your
 * own reference clip: the closer the timeline, the closer the render follows it.
 */
type VideoServerMedia = {
  referenceVideoPath: string;
  /** Templates without one render silent videos (see videoTemplates[id].soundtrack). */
  soundtrackPath?: string;
  /** Receives how many photos the job casts (fewer than the slots only when minPhotos allows). */
  buildPrompt: (photoCount: number) => string;
};

type VideoServerTemplate = VideoServerMedia & { highlight?: VideoServerMedia };

function media(id: VideoTemplateId, cut: "" | "-highlight" = "") {
  return {
    referenceVideoPath: `templates/${id}/reference${cut}.mp4`,
    soundtrackPath: `templates/${id}/soundtrack${cut}.m4a`,
  };
}

// Draft timeline for the "star entrance" version of the trend. Re-time every shot against the
// depth reference clip once it is made (docs/viral-template-playbook.zh-CN.md §1–2).
const aiCelebrityAutograph: ReferencePromptSpec = {
  title: "竖屏明星出场签名短片",
  aspectRatio: "9:16 竖屏",
  durationSeconds: 10,
  cast: [
    {
      role: "明星（主角）",
      action:
        "全程是画面焦点：从酒店门口走出，自信地对粉丝挥手，接过一位粉丝递来的笔，在对方的本子上快速签名，最后抬头对镜头微笑。",
    },
  ],
  scene:
    "夜晚的高级酒店门口，暖色门廊灯和玻璃旋转门，红色地毯，两侧金属护栏后挤满举着手机拍摄的成年粉丝，手机闪光灯和屏幕光此起彼伏。主角身边有一名穿黑西装、戴耳麦的保镖。粉丝和保镖都是普通路人长相，不像任何真实名人。签名只是潦草的笔画，不出现可读的文字或真实签名。",
  camera:
    "粉丝视角的手持竖屏拍摄，略带晃动和自动对焦呼吸感。开场中景，主角走近时跟拍到近景，签名时给本子和手部一个短暂的近景，结尾回到主角的半身近景。",
  shots: [
    {
      time: "00.00—03.00",
      title: "走出酒店",
      body: "主角在保镖陪同下从酒店门口走出，粉丝尖叫举起手机，闪光灯连闪。",
    },
    {
      time: "03.00—06.00",
      title: "沿护栏走近",
      body: "主角沿着护栏朝镜头走来，向两侧粉丝挥手致意，保镖在一侧护着。",
    },
    {
      time: "06.00—09.00",
      title: "签名",
      body: "一位粉丝从护栏后递出本子和笔，主角接过笔在本子上快速签了几笔，把笔递回去。",
    },
    {
      time: "09.00—10.00",
      title: "看镜头",
      body: "主角抬头看向镜头，露出自然的明星式微笑，画面停在半身近景。",
    },
  ],
  avoid: [
    "画面里只有一个主角，其他人都是背景里的粉丝和保镖，不复制主角的脸。",
    "不出现任何真实明星、品牌标志、酒店名称或可读的签名文字。",
  ],
  depthReference: true,
};

export const videoServerTemplates: Record<VideoTemplateId, VideoServerTemplate> = {
  ai_celebrity_autograph: {
    ...media("ai_celebrity_autograph"),
    buildPrompt: (photos) => buildReferencePrompt(aiCelebrityAutograph, photos),
  },
};
