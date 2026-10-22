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

// Fan-meet signing table, timed against the depth reference made from CapCut template
// 7694879116847353095 (one continuous 11s fan-cam shot, no cuts).
const aiCelebrityAutograph: ReferencePromptSpec = {
  title: "竖屏粉丝见面会签名短片",
  aspectRatio: "9:16 竖屏",
  durationSeconds: 11,
  cast: [
    {
      role: "明星（主角）",
      action:
        "全程是画面焦点：从画面左侧走到签名桌后坐下，对粉丝微笑，用记号笔在粉丝递来的自己的照片上签名，签完递回去并开心地笑。",
    },
  ],
  scene:
    "明亮的室内粉丝见面会场地，浅色墙面和白色立柱。主角身后立着一幅巨大的人像海报，海报上是主角本人的精修大头照，长相与主角完全一致。主角面前是铺黑色桌布的长桌，桌上放着待签的照片和记号笔。前景是一排举着手机拍摄的成年粉丝的手和后脑勺，手机屏幕里拍的也是主角。主角身后站着一名穿黑色T恤的保镖。粉丝和保镖都是普通路人长相，不像任何真实名人。签名只是潦草的笔画，不出现可读的文字或真实签名。",
  camera:
    "粉丝视角的手持竖屏拍摄，在粉丝的手机之间略有晃动和自动对焦呼吸感。开场跟随主角入场，落座后保持中近景并缓慢推近。整段是一个连续镜头，没有剪辑。",
  shots: [
    {
      time: "00.00—02.00",
      title: "入场",
      body: "主角在保镖陪同下从画面左侧走向签名桌，前排粉丝纷纷举起手机。",
    },
    {
      time: "02.00—04.00",
      title: "落座",
      body: "主角在桌后坐下，接过粉丝递来的照片，抬头对镜头微笑。",
    },
    {
      time: "04.00—09.00",
      title: "签名",
      body: "主角低头用记号笔在照片上快速签名，中途抬眼看了看粉丝。",
    },
    {
      time: "09.00—11.00",
      title: "递回",
      body: "主角把签好的照片递回给粉丝，开心地笑着看向镜头。",
    },
  ],
  avoid: [
    "画面里只有一个主角；海报上的人就是主角本人；粉丝和保镖不长主角的脸。",
    "不出现任何真实明星、品牌标志或可读的签名文字。",
  ],
  depthReference: true,
};

export const videoServerTemplates: Record<VideoTemplateId, VideoServerTemplate> = {
  ai_celebrity_autograph: {
    ...media("ai_celebrity_autograph"),
    buildPrompt: (photos) => buildReferencePrompt(aiCelebrityAutograph, photos),
  },
};
