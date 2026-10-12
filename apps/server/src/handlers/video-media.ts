import { videoConfig, isVideoModel, isVideoTemplateId } from "@repo/app-config/video";
import type { Context as HonoContext } from "hono";
import { VIDEO_STORAGE_PREFIX, getVideoTemplate, templateMediaUrl } from "../video/config";

/**
 * GET /api/video/media/*
 *
 * Serves uploaded photos and finished renders from R2 with HTTP Range support,
 * which Safari requires before it will play an mp4.
 */
export async function handleVideoMedia(
  c: HonoContext<{ Bindings: Cloudflare.Env }>,
): Promise<Response> {
  const key = decodeURIComponent(c.req.path.replace("/api/video/media/", ""));
  if (!key.startsWith(`${VIDEO_STORAGE_PREFIX}/`) || key.includes("..")) {
    return c.json({ error: "Not found" }, 404);
  }

  const rangeHeader = c.req.header("range");
  const object = await c.env.STORAGE.get(key, rangeHeader ? { range: c.req.raw.headers } : {});
  if (!object) {
    return c.json({ error: "Not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=86400");
  if (c.req.query("download") === "1") {
    headers.set("Content-Disposition", `attachment; filename="${key.split("/").at(-1)}"`);
  }

  const range = object.range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (rangeHeader && range) {
    const offset = range.suffix == null ? (range.offset ?? 0) : object.size - range.suffix;
    const length = range.suffix ?? range.length ?? object.size - offset;
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("Content-Length", String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}

/**
 * GET /api/video/soundtrack?template=<id>&model=<model>
 *
 * Proxies a template's soundtrack (default: videoConfig.defaultTemplateId) so browsers can fetch it under
 * the API's CORS policy and mux it into finished renders. Seedance 2.0 models get the
 * highlight cut's soundtrack; without a model it is the full clip's.
 */
export async function handleVideoSoundtrack(
  c: HonoContext<{ Bindings: Cloudflare.Env }>,
): Promise<Response> {
  const requested = c.req.query("template");
  const templateId = isVideoTemplateId(requested) ? requested : videoConfig.defaultTemplateId;
  const model = c.req.query("model");
  const { soundtrackPath } = getVideoTemplate(
    templateId,
    isVideoModel(model) ? model : "seedance-2.5",
  );
  const source = soundtrackPath ? templateMediaUrl(c.env, soundtrackPath) : null;
  if (!source) {
    return c.json({ error: "Not found" }, 404);
  }

  const upstream = await fetch(source);
  if (!upstream.ok || !upstream.body) {
    return c.json({ error: "Soundtrack unavailable" }, 502);
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "audio/mp4");
  headers.set("Cache-Control", "public, max-age=86400");
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(upstream.body, { status: 200, headers });
}
