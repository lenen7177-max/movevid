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

const duoDance: ReferencePromptSpec = {
  title: "竖屏双人舞蹈短片",
  aspectRatio: "9:16 竖屏",
  durationSeconds: 20,
  cast: [
    { role: "左侧舞者", action: "全程站在画面左侧，跳完整段编舞，和右侧舞者有眼神互动。" },
    { role: "右侧舞者", action: "全程站在画面右侧，与左侧舞者动作同步，结尾一起定格。" },
  ],
  scene:
    "明亮的室内练舞室，浅色木地板，一面落地镜，柔和的顶光加侧窗自然光。地面有自然接触阴影。不增加文字或品牌元素。",
  camera:
    "固定机位正面全景为主，中段有一次推近到双人半身，结尾回到全景。保留轻微手持感与自然运动模糊，不新增镜头。",
  shots: [
    {
      time: "00.00—04.00",
      title: "双人入场",
      body: "两人从画面两侧走到中央站定，相视一笑，跟随节拍点头准备。",
    },
    {
      time: "04.00—12.00",
      title: "主歌编舞",
      body: "两人同步完成手臂波浪、侧步、转身和拍手，动作与@视频1 的节拍和切点对齐。",
    },
    {
      time: "12.00—17.00",
      title: "推近半身",
      body: "镜头推近到双人半身，两人肩靠肩做手部动作并对镜头微笑。",
    },
    {
      time: "17.00—20.00",
      title: "收尾定格",
      body: "镜头拉回全景，两人完成最后一个八拍，摆出同一个结束姿势并定格。",
    },
  ],
};

const duoDanceHighlight: ReferencePromptSpec = {
  ...duoDance,
  durationSeconds: 12,
  shots: [
    {
      time: "00.00—07.00",
      title: "主歌编舞",
      body: "两人同步完成手臂波浪、侧步、转身和拍手，动作与@视频1 的节拍和切点对齐。",
    },
    {
      time: "07.00—12.00",
      title: "推近半身并定格",
      body: "镜头推近到双人半身，两人肩靠肩做手部动作，最后摆出同一个结束姿势。",
    },
  ],
};

const soloSpotlight: ReferencePromptSpec = {
  title: "竖屏单人聚光灯表演短片",
  aspectRatio: "9:16 竖屏",
  durationSeconds: 10,
  cast: [
    {
      role: "主角",
      action:
        "站在舞台中央的聚光灯下完成整段表演。照片若是猫狗等宠物，就让这只宠物以拟人的姿态完成同样的动作。",
    },
  ],
  scene:
    "黑色小剧场舞台，一束暖白色聚光灯从上方打下，背景有轻微烟雾和点状灯光虚化。地面反射聚光灯光斑。",
  camera: "中景开场，随动作缓慢推近到近景，最后一个动作时轻微仰拍。保留胶片颗粒感，不加滤镜。",
  shots: [
    {
      time: "00.00—03.00",
      title: "灯亮",
      body: "聚光灯亮起，主角抬头看向镜头，整理衣领。",
    },
    {
      time: "03.00—08.00",
      title: "高光动作",
      body: "主角跟随节拍完成转身、指向镜头和一个标志性的定点动作。",
    },
    {
      time: "08.00—10.00",
      title: "谢幕",
      body: "主角对镜头鞠躬或挥手，聚光灯慢慢收窄。",
    },
  ],
};

const squadWalk: ReferencePromptSpec = {
  title: "横屏好友慢动作走来短片",
  aspectRatio: "16:9 横屏",
  durationSeconds: 12,
  cast: [
    { role: "中间的人", action: "走在队伍正中，节奏最稳，结尾摘下墨镜看向镜头。" },
    { role: "左侧的人", action: "走在中间人的左边，边走边整理外套。" },
    { role: "右侧的人", action: "走在中间人的右边，边走边转头和左侧的人击掌。" },
  ],
  scene: "傍晚的城市街道，路面微湿反光，两侧是虚化的霓虹招牌和路灯，逆光让人物边缘有暖色轮廓光。",
  camera: "长焦低机位正面跟拍，人物以慢动作朝镜头走来，景深很浅，结尾停在中近景。",
  shots: [
    {
      time: "00.00—05.00",
      title: "并排走来",
      body: "人物从远处并排朝镜头走来，步伐一致，头发和衣角随慢动作摆动。",
    },
    {
      time: "05.00—09.00",
      title: "互动",
      body: "按各自的动作描述互动，始终保持并排队形和统一步速。",
    },
    {
      time: "09.00—12.00",
      title: "收尾",
      body: "人物在镜头前停下，看向镜头，画面停在中近景。",
    },
  ],
  avoid: ["人物数量严格等于照片数量，不补充路人或额外的同伴。"],
};

export const videoServerTemplates: Record<VideoTemplateId, VideoServerTemplate> = {
  duo_dance: {
    ...media("duo_dance"),
    buildPrompt: (photos) => buildReferencePrompt(duoDance, photos),
    highlight: {
      ...media("duo_dance", "-highlight"),
      buildPrompt: (photos) => buildReferencePrompt(duoDanceHighlight, photos),
    },
  },
  solo_spotlight: {
    ...media("solo_spotlight"),
    buildPrompt: (photos) => buildReferencePrompt(soloSpotlight, photos),
  },
  squad_walk: {
    ...media("squad_walk"),
    buildPrompt: (photos) => buildReferencePrompt(squadWalk, photos),
  },
};
