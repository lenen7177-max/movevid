/**
 * Minimal APIMart client for Seedance video tasks.
 * Docs: https://docs.apimart.ai/en/api-reference/videos/seedance-2-5/generation
 */

export type ApimartTaskStatus =
  | "submitted"
  | "pending"
  | "processing"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type ApimartTask = {
  status?: ApimartTaskStatus;
  progress?: number;
  videoUrl?: string;
  cost?: number;
  error?: string;
};

export type ApimartVideoRequest = {
  model: string;
  prompt: string;
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  resolution: string;
  size: string;
  duration: number;
  generateAudio: boolean;
  /** Seedance 2.5 only; Seedance 2.0 models don't take it. */
  taskType?: "auto" | "reference" | "edit" | "extend";
};

type ApimartEnv = Pick<Cloudflare.Env, "APIMART_API_KEY" | "APIMART_BASE_URL">;

const REQUEST_TIMEOUT_MS = 30_000;

function resolveBase(env: ApimartEnv): { base: string; key: string } {
  const key = env.APIMART_API_KEY;
  if (!key) throw new Error("missing_apimart_key");
  return { base: (env.APIMART_BASE_URL || "https://api.apimart.ai").replace(/\/$/, ""), key };
}

/** Uploads an image to APIMart and returns a URL Seedance can read. */
export async function uploadImage(env: ApimartEnv, file: Blob, fileName: string): Promise<string> {
  const { base, key } = resolveBase(env);
  const form = new FormData();
  form.set("file", file, fileName);
  const resp = await fetch(`${base}/v1/uploads/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw await errorFromResponse(resp, "apimart_upload");
  const payload = (await resp.json()) as { url?: unknown; data?: { url?: unknown } };
  const url = readString(payload.url) ?? readString(payload.data?.url);
  if (!url) throw new Error("apimart_upload_url_missing");
  return url;
}

export type ApimartAssetTask = {
  status?: ApimartTaskStatus;
  /** `asset://…` URL once the photo passes review. */
  assetUrl?: string;
  error?: string;
};

/**
 * Submits one photo to the Seedance asset library for review and returns the review task id.
 * Real faces have to go through the library; review is free and usually takes seconds.
 */
export async function submitImageAsset(
  env: ApimartEnv,
  input: { model: string; imageUrl: string; name: string; groupId?: string },
): Promise<string> {
  const { base, key } = resolveBase(env);
  const resp = await fetch(`${base}/v1/seedance2/private-avatar/assets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      // Without a group id the provider creates a new group on every call.
      ...(input.groupId
        ? { group_id: input.groupId }
        : { group: { name: "video-template-photos" } }),
      asset_type: "Image",
      assets: [{ url: input.imageUrl, name: input.name }],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw await errorFromResponse(resp, "apimart_asset");
  const taskId = parseTaskId(await resp.json());
  if (!taskId) throw new Error("apimart_asset_task_id_missing");
  return taskId;
}

/** Reads a photo review task; `assetUrl` is set once the photo is approved. */
export async function getAssetTask(env: ApimartEnv, taskId: string): Promise<ApimartAssetTask> {
  const { base, key } = resolveBase(env);
  const resp = await fetch(`${base}/v1/tasks/${encodeURIComponent(taskId)}?language=en`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw await errorFromResponse(resp, "apimart_asset_task");
  const payload = (await resp.json()) as {
    data?: {
      status?: unknown;
      result?: { asset_url?: unknown; usable_assets?: Array<{ asset_url?: unknown }> };
      error?: { message?: unknown } | string;
      fail_reason?: unknown;
    };
  };
  const data = payload.data ?? {};
  const error =
    typeof data.error === "string"
      ? readString(data.error)
      : (readString(data.error?.message) ?? readString(data.fail_reason));
  return {
    status: typeof data.status === "string" ? (data.status as ApimartTaskStatus) : undefined,
    assetUrl:
      readString(data.result?.usable_assets?.[0]?.asset_url) ?? readString(data.result?.asset_url),
    error,
  };
}

/** Deletes one photo from the Seedance asset library; accepts an asset id or `asset://` URL. */
export async function deleteAsset(env: ApimartEnv, asset: string): Promise<void> {
  const { base, key } = resolveBase(env);
  const id = asset.replace(/^asset:\/\//, "");
  const resp = await fetch(`${base}/v1/seedance2/private-avatar/assets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  // Already gone counts as done.
  if (!resp.ok && resp.status !== 404) throw await errorFromResponse(resp, "apimart_asset_delete");
}

export type ApimartAsset = { id: string; name: string; createdAt: Date };

/** Lists one page of an asset group, newest first. */
export async function listAssets(
  env: ApimartEnv,
  input: { groupId: string; page: number; pageSize: number },
): Promise<{ items: ApimartAsset[]; total: number }> {
  const { base, key } = resolveBase(env);
  const query = new URLSearchParams({
    group_id: input.groupId,
    page_number: String(input.page),
    page_size: String(input.pageSize),
  });
  const resp = await fetch(`${base}/v1/seedance2/private-avatar/assets?${query}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw await errorFromResponse(resp, "apimart_asset_list");
  const payload = (await resp.json()) as {
    Result?: {
      Items?: Array<{ Id?: unknown; Name?: unknown; CreateTime?: unknown }>;
      TotalCount?: unknown;
    };
  };
  const items = (payload.Result?.Items ?? []).flatMap((item) => {
    const id = readString(item.Id);
    const created = readString(item.CreateTime);
    return id && created
      ? [{ id, name: readString(item.Name) ?? "", createdAt: new Date(created) }]
      : [];
  });
  const total =
    typeof payload.Result?.TotalCount === "number" ? payload.Result.TotalCount : items.length;
  return { items, total };
}

/** Submits a Seedance video task and returns the provider task id. */
export async function submitVideoTask(
  env: ApimartEnv,
  request: ApimartVideoRequest,
): Promise<string> {
  const { base, key } = resolveBase(env);
  const resp = await fetch(`${base}/v1/videos/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      prompt: request.prompt,
      image_urls: request.imageUrls,
      video_urls: request.videoUrls,
      ...(request.audioUrls.length > 0 ? { audio_urls: request.audioUrls } : {}),
      resolution: request.resolution,
      size: request.size,
      duration: request.duration,
      generate_audio: request.generateAudio,
      ...(request.taskType ? { omni_reference_task_type: request.taskType } : {}),
      watermark: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw await errorFromResponse(resp, "apimart_submit");
  const taskId = parseTaskId(await resp.json());
  if (!taskId) throw new Error("apimart_task_id_missing");
  return taskId;
}

/** Reads the current state of a video task. */
export async function getVideoTask(env: ApimartEnv, taskId: string): Promise<ApimartTask> {
  const { base, key } = resolveBase(env);
  const resp = await fetch(`${base}/v1/tasks/${encodeURIComponent(taskId)}?language=en`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw await errorFromResponse(resp, "apimart_task");
  return parseTask(await resp.json());
}

function parseTaskId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const data = (payload as { data?: unknown }).data;
  const first = Array.isArray(data) ? data[0] : data;
  if (first && typeof first === "object") {
    const record = first as { task_id?: unknown; id?: unknown };
    return readString(record.task_id) ?? readString(record.id);
  }
  return readString((payload as { task_id?: unknown }).task_id);
}

function parseTask(payload: unknown): ApimartTask {
  const data =
    payload && typeof payload === "object" ? (payload as { data?: unknown }).data : undefined;
  const task = data && typeof data === "object" && !Array.isArray(data) ? data : payload;
  if (!task || typeof task !== "object") return {};
  const record = task as {
    status?: unknown;
    progress?: unknown;
    cost?: unknown;
    result?: { videos?: Array<{ url?: unknown }> };
    error?: { message?: unknown } | string;
    fail_reason?: unknown;
  };
  const firstUrl = record.result?.videos?.[0]?.url;
  const videoUrl = Array.isArray(firstUrl) ? readString(firstUrl[0]) : readString(firstUrl);
  const error =
    typeof record.error === "string"
      ? readString(record.error)
      : (readString(record.error?.message) ?? readString(record.fail_reason));
  return {
    status: typeof record.status === "string" ? (record.status as ApimartTaskStatus) : undefined,
    progress: typeof record.progress === "number" ? record.progress : undefined,
    cost: typeof record.cost === "number" ? record.cost : undefined,
    videoUrl,
    error,
  };
}

/** Remaining USD balance of the whole APIMart account (not just this key's quota). */
export async function getAccountBalance(env: ApimartEnv): Promise<number> {
  const { base, key } = resolveBase(env);
  const resp = await fetch(`${base}/v1/user/balance`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw await errorFromResponse(resp, "apimart_balance");
  const payload = (await resp.json()) as { remain_balance?: unknown };
  if (typeof payload.remain_balance !== "number") throw new Error("apimart_balance_missing");
  return payload.remain_balance;
}

/** Asks a vision chat model one question about an image and returns its text answer. */
export async function describeImage(
  env: ApimartEnv,
  input: { model: string; prompt: string; imageUrl: string; timeoutMs: number },
): Promise<string> {
  const { base, key } = resolveBase(env);
  const resp = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      stream: false,
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: input.prompt },
            { type: "image_url", image_url: { url: input.imageUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  if (!resp.ok) throw await errorFromResponse(resp, "apimart_chat");
  const payload = (await resp.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const text = readString(payload.choices?.[0]?.message?.content);
  if (!text) throw new Error("apimart_chat_empty");
  return text.trim();
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function errorFromResponse(resp: Response, prefix: string): Promise<Error> {
  const text = await resp.text().catch(() => "");
  let detail = "";
  try {
    const parsed = JSON.parse(text) as { error?: { code?: unknown; message?: unknown } };
    detail = readString(parsed.error?.message) ?? readString(parsed.error?.code) ?? "";
  } catch {
    detail = text.slice(0, 200);
  }
  return new Error(detail ? `${prefix}_${resp.status}: ${detail}` : `${prefix}_${resp.status}`);
}
