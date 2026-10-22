/**
 * Builds Seedance prompts for "re-cast a reference clip" templates.
 *
 * Media order in the request decides the @ handles Seedance understands:
 *   @视频1 = the template's reference clip
 *   @图片1, @图片2, … = the uploaded photos, in the template's slot order
 * Seedance on APIMart reads these Chinese handles, so keep them as they are even when the
 * rest of a prompt is written in another language.
 *
 * Seedance 2.0 rejects prompts over 4000 characters; keep each template well under that
 * (the server test checks it), since appearance notes are appended at render time.
 */

export type PromptCastMember = {
  /** Who this photo plays, e.g. "领舞" (lead dancer). */
  role: string;
  /** What this person does across the clip. */
  action: string;
};

export type PromptShot = {
  /** "00.00—03.50", matching the cuts in the reference clip. */
  time: string;
  title: string;
  body: string;
};

export type ReferencePromptSpec = {
  /** One line naming the clip, e.g. "竖屏双人舞蹈短片". */
  title: string;
  aspectRatio: string;
  durationSeconds: number;
  /** One entry per photo slot, in slot order. */
  cast: PromptCastMember[];
  /** Set, lighting and props. The reference clip may carry no color (depth maps). */
  scene: string;
  /** Camera and editing style. */
  camera: string;
  shots: PromptShot[];
  /** Extra mistakes to rule out, on top of the shared ones. */
  avoid?: string[];
  /** Whether the reference clip is a depth map (grayscale silhouettes) rather than real footage. */
  depthReference?: boolean;
};

const SHARED_AVOID = [
  "禁止人物身份漂移、脸型变化、人物复制或两人互换。",
  "禁止肢体穿模、手指粘连、道具瞬移。",
  "禁止增加字幕、标志、平台水印、账号文字或片尾。",
  "禁止慢动作、擅自延长镜头或改变节奏。",
];

/**
 * Prompt for `photoCount` photos. Templates with optional photos (minPhotos below the slot
 * count) only cast the first `photoCount` members; the rest of the cast is dropped.
 */
export function buildReferencePrompt(spec: ReferencePromptSpec, photoCount: number): string {
  const cast = spec.cast.slice(0, Math.max(1, photoCount));
  const handles = cast.map((member, index) => `${member.role}完整使用@图片${index + 1} 中的人物`);
  const reference = spec.depthReference
    ? "@视频1 是一段灰度深度图视频，只用来提供动作、站位、摄影机运动、剪辑切点和时间顺序。深度图中的灰白剪影不是人物外观，不要生成灰白色、剪影化或深度图风格的画面。剪影以外的纯黑部分没有任何场景信息，场景完全按【二、场景】生成。"
    : "@视频1 只用来提供动作、站位、摄影机运动、剪辑切点和时间顺序，不沿用其中人物的外貌和服装。";

  const intro = [
    `【任务：按参考视频逐镜复刻${spec.title}，人物来自 ${cast.length} 张照片】`,
    reference,
    `${handles.join("，")}。`,
    `最终画面是全彩真人实拍质感，${spec.aspectRatio}，时长 ${spec.durationSeconds} 秒，保留各段动作的实际速度。`,
    `全片只有以上 ${cast.length} 个人物，不出现其他人或人物分身。`,
  ].join("\n");

  const identity = [
    "【一、人物一致性】",
    ...cast.map((member, index) => `@图片${index + 1}（${member.role}）：${member.action}`),
    "每个人的脸、五官比例、发型发色、肤色、眼镜等配饰和体型以各自的照片为准，全片保持一致，不融合、不美颜成另一张脸。",
    "照片中看不到的服装部分，生成与照片风格一致、简洁自然的日常服装，全片不变。",
  ].join("\n");

  const scene = `【二、场景】\n${spec.scene}`;
  const camera = `【三、摄影与剪辑】\n${spec.camera}`;
  const shots = [
    "【四、逐镜时间轴】",
    ...spec.shots.map((shot, index) => {
      const n = String(index + 1).padStart(2, "0");
      return `镜头${n}｜${shot.time}｜${shot.title}\n${shot.body}`;
    }),
  ].join("\n\n");
  const avoid = ["【五、必须避免】", ...SHARED_AVOID, ...(spec.avoid ?? [])].join("\n");

  return [intro, identity, scene, camera, shots, avoid].join("\n\n");
}
