/**
 * Per-photo appearance notes for the render prompt.
 *
 * Reference clips carry the original performers' silhouettes, and Seedance tends to fill a
 * long, curly outline with long, curly hair whatever the photo shows. A generic "follow the
 * photo" rule does not hold, so a vision model describes each photo's hair and headwear in
 * words, and the notes are pinned into the prompt per @图片 handle.
 */

export const APPEARANCE_NOTE_QUESTION =
  "只描述照片中这个人的发型和头部配饰，用一句不超过 40 字的中文：" +
  "头发长度（以耳朵、下巴、肩膀、胸前为参照）、直发还是卷发、发色、有没有刘海、分缝或扎法，" +
  "以及是否戴眼镜、帽子或头饰。不要描述脸、表情、身份、年龄或衣服。看不清就只输出：未知";

const MAX_NOTE_LENGTH = 80;

/** Keeps a model answer to one short line; drops "unknown" answers. */
export function cleanAppearanceNote(note: string | null): string | null {
  const line = note?.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_LENGTH);
  if (!line || line.startsWith("未知")) {
    return null;
  }
  return line;
}

/** Appends the notes (in @图片 order) to a template prompt; returns it unchanged without notes. */
export function appendAppearanceNotes(prompt: string, notes: Array<string | null>): string {
  const lines = notes.flatMap((note, index) => (note ? [`@图片${index + 1}：${note}`] : []));
  if (lines.length === 0) {
    return prompt;
  }
  const section = [
    "【补充：每个人物的发型（根据参考照片识别）】",
    ...lines,
    "每个镜头都按以上描述生成发型和头部配饰。@视频1 中的头部轮廓只代表原人物，不能改变以上人物的头发长度、卷度和颜色。",
  ].join("\n");
  return `${prompt}\n\n${section}`;
}
