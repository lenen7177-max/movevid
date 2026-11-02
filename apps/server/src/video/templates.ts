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

// 手臂弯举心形. Confirmed Seedance prompt, mapped into ReferencePromptSpec.
// One continuous 7s front medium shot; timeline matches the depth reference.
const bicepHeart: ReferencePromptSpec = {
  title: "竖屏手臂弯举心形短片",
  aspectRatio: "9:16 竖屏",
  durationSeconds: 7,
  cast: [
    {
      role: "用户上身",
      action:
        "弯举手臂出现心形。全程是画面唯一的人物：同一张脸、五官比例、年龄感、性别、发型发色、肤色、眼镜等面部配饰和体型以照片为准，近景和远景都保持可辨认，不融合、不交换、不漂移。表情从轻柔微笑到自豪、甜蜜的微笑，随表演自然变化，不要始终保持照片中的静态表情。眼镜、帽子、胡子严格跟随照片：照片里没有的，全片都不加。发型严格跟随照片，包括头发长度、卷度和颜色；头发随动作自然摆动，发根稳定，不变短、不变色、不穿过脸部。自然人体：两只手臂、两只手、每只手五根手指；手臂和肌肉体量跟照片本人一致，不额外增大肌肉。照片里能看到的服装沿用照片，看不到的部分生成与照片风格一致的日常服装，全片不变。照片中手里拿着的物品不要带入画面。深度图中的头部轮廓只代表原人物，必须忽略，不能据此改变发型或服装：深色马尾或深色长发、黑色短袖T恤、黑色腕表、手环，除非照片本身有这些。",
    },
  ],
  scene:
    "手臂弯举出现心形。深度图没有颜色信息，场景沿用照片的背景，把它自然延伸成9:16竖屏；照片看不出背景时，生成一个普通的家里客厅或整洁室内，暖色低光。不要照搬参考视频里的原房间（青绿墙、白色门框等）。不要出现可辨认的品牌标志、文字、水印、店名、队徽、号码或可读车牌。本片无额外道具。朋友随手拍的竖屏短视频质感：自然运动模糊，真实皮肤质感，不要磨皮，不要夸张锐化，不要美颜滤镜。",
  camera:
    "正面中景。一镜到底的固定机位正面中景，保留固定机位与轻微手持感（如有）。不新增慢镜头、长距离环绕、无人机镜头或重新设计的运镜。下列时间点用于对齐，具体切点、动作起止、运动轨迹和镜头运动以深度参考视频为准。保留动作的实际速度，不慢放、不加长、不压缩。在7秒处干净结束。发生冲突时：人物外貌、发型和服装以照片为准；动作、镜头和时间以深度参考视频为准。",
  shots: [
    {
      time: "00.00—02.00",
      title: "低位合手",
      body: "中景正面：双手在身前低位合拢或自然相贴，对镜头轻轻微笑。",
    },
    {
      time: "02.00—03.50",
      title: "横臂",
      body: "同一机位：一只手臂横过胸前，该手抓住另一只上臂。",
    },
    {
      time: "03.50—04.00",
      title: "弯举",
      body: "另一只手臂向上弯举成清晰的二头肌弯举，拳头靠近头侧。",
    },
    {
      time: "04.00—07.00",
      title: "心形",
      body: "横过胸前的那只手用拇指与手指贴住弯举手臂内侧，手与手臂曲线合成一个清晰心形；保持姿势到结束，自豪甜蜜微笑并轻微侧头。",
    },
  ],
  avoid: [
    "禁止灰度、剪影或深度图风格的画面。",
    "禁止出现字幕、水印、标志或文字（包括「have you ever heard of a bicep heart...」类文案）。",
    "禁止屏幕上叠加心形贴纸、标签或图形。心形只由手和手臂摆出。",
    "禁止重新设计剧情、删掉原有互动或增加新动作。",
    "禁止把主角生成成参考视频原人物或任何明星、公众人物的样子。",
    "禁止给人物添加参考图里没有的衣服、配件或道具（尤其原片的黑T恤、黑色腕表、手环、深色马尾）。",
    "禁止手指畸形。",
    "禁止要求模型出声、音乐、音效或台词。",
  ],
  depthReference: true,
};

export const videoServerTemplates: Record<VideoTemplateId, VideoServerTemplate> = {
  ai_celebrity_autograph: {
    ...media("ai_celebrity_autograph"),
    buildPrompt: (photos) => buildReferencePrompt(aiCelebrityAutograph, photos),
  },
  bicep_heart_ai_video: {
    referenceVideoPath: "templates/bicep_heart_ai_video/reference.mp4",
    // No soundtrackPath: this template ships silent (videoTemplates soundtrack: false).
    buildPrompt: (photos) => buildReferencePrompt(bicepHeart, photos),
  },
};
