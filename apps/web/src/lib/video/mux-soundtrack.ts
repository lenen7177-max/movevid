import { type VideoModel, type VideoTemplateId, isVideoHighlight } from "@repo/app-config/video";

/**
 * Adds the template's soundtrack to a finished (silent) render, in the browser.
 *
 * Packets are copied as-is (H.264 video + AAC audio), so nothing is re-encoded
 * and it works without WebCodecs encoders. The soundtrack starts at 0s and is
 * cut at the video's end. Highlight renders get the highlight cut's soundtrack.
 */

const SOUNDTRACK_URL = `${import.meta.env.VITE_SERVER_URL}/api/video/soundtrack`;

const soundtrackPromises = new Map<string, Promise<Blob>>();

function loadSoundtrack(templateId: VideoTemplateId, model: VideoModel): Promise<Blob> {
  // Full renders share one soundtrack whatever the model; only highlight cuts differ.
  const key = isVideoHighlight(templateId, model) ? `${templateId}:highlight` : templateId;
  const cached = soundtrackPromises.get(key);
  if (cached) return cached;
  const promise = fetch(`${SOUNDTRACK_URL}?template=${templateId}&model=${model}`).then((resp) => {
    if (!resp.ok) throw new Error(`soundtrack_${resp.status}`);
    return resp.blob();
  });
  soundtrackPromises.set(key, promise);
  // Let a failed download be retried next time.
  promise.catch(() => {
    soundtrackPromises.delete(key);
  });
  return promise;
}

export async function muxSoundtrack(
  videoUrl: string,
  templateId: VideoTemplateId,
  model: VideoModel,
): Promise<Blob> {
  const [
    {
      ALL_FORMATS,
      BlobSource,
      BufferTarget,
      EncodedAudioPacketSource,
      EncodedPacketSink,
      EncodedVideoPacketSource,
      Input,
      Mp4OutputFormat,
      Output,
    },
    videoBlob,
    audioBlob,
  ] = await Promise.all([
    import("mediabunny"),
    fetch(videoUrl).then((resp) => {
      if (!resp.ok) throw new Error(`video_${resp.status}`);
      return resp.blob();
    }),
    loadSoundtrack(templateId, model),
  ]);

  const videoInput = new Input({ source: new BlobSource(videoBlob), formats: ALL_FORMATS });
  const audioInput = new Input({ source: new BlobSource(audioBlob), formats: ALL_FORMATS });
  const videoTrack = await videoInput.getPrimaryVideoTrack();
  const audioTrack = await audioInput.getPrimaryAudioTrack();
  if (!videoTrack?.codec || !audioTrack?.codec) throw new Error("mux_tracks_missing");

  const [videoConfig, audioConfig, videoEnd] = await Promise.all([
    videoTrack.getDecoderConfig(),
    audioTrack.getDecoderConfig(),
    videoTrack.computeDuration(),
  ]);
  if (!videoConfig || !audioConfig) throw new Error("mux_config_missing");

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const videoSource = new EncodedVideoPacketSource(videoTrack.codec);
  const audioSource = new EncodedAudioPacketSource(audioTrack.codec);
  output.addVideoTrack(videoSource, { rotation: videoTrack.rotation });
  output.addAudioTrack(audioSource);
  await output.start();

  const videoPackets = [];
  for await (const packet of new EncodedPacketSink(videoTrack).packets()) {
    videoPackets.push(packet);
  }
  const audioPackets = [];
  for await (const packet of new EncodedPacketSink(audioTrack).packets()) {
    if (packet.timestamp >= videoEnd) break;
    audioPackets.push(packet);
  }

  // Feed both tracks in timestamp order so the muxer can interleave them.
  let v = 0;
  let a = 0;
  while (v < videoPackets.length || a < audioPackets.length) {
    const nextVideo = videoPackets[v];
    const nextAudio = audioPackets[a];
    if (nextVideo && (!nextAudio || nextVideo.timestamp <= nextAudio.timestamp)) {
      await videoSource.add(nextVideo, v === 0 ? { decoderConfig: videoConfig } : undefined);
      v += 1;
    } else if (nextAudio) {
      await audioSource.add(nextAudio, a === 0 ? { decoderConfig: audioConfig } : undefined);
      a += 1;
    }
  }

  videoSource.close();
  audioSource.close();
  await output.finalize();

  const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
  if (!buffer) throw new Error("mux_empty");
  return new Blob([buffer], { type: "video/mp4" });
}
