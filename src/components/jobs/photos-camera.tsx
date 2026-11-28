"use client";

import { useEffect, useRef, useState } from "react";
import { JobsButton } from "@/components/jobs/ui";

export function GhostCamera({
  beforeUrl,
  onCapture,
  onClose,
}: {
  beforeUrl: string;
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [opacity, setOpacity] = useState(0.4);
  const [live, setLive] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!navigator.mediaDevices?.getUserMedia || !video) {
      setBlocked(true);
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((next) => {
        if (cancelled) {
          for (const track of next.getTracks()) track.stop();
          return;
        }
        stream = next;
        video.srcObject = next;
        return video.play();
      })
      .then(() => {
        if (!cancelled) setLive(true);
      })
      .catch(() => {
        if (!cancelled) setBlocked(true);
      });
    return () => {
      cancelled = true;
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, []);

  async function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob) return;
    onCapture(new File([blob], "after.jpg", { type: "image/jpeg" }));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted autoPlay className={`aspect-[3/4] w-full object-cover ${live ? "" : "hidden"}`} />
        {live ? (
          // The before photo is a same-origin JPEG from the jobs API.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={beforeUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ opacity }} />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center px-4 text-center text-white">
            {blocked ? "The live camera is not available." : "Opening the camera"}
          </div>
        )}
      </div>
      {live ? (
        <label className="flex flex-col gap-2 text-base">
          Ghost photo
          <input
            type="range"
            min={0.15}
            max={0.75}
            step={0.05}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
            className="min-h-11"
          />
        </label>
      ) : null}
      {blocked ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeUrl} alt="Before photo" className="h-20 w-20 rounded-xl object-cover" />
          <p className="text-base">Match this angle with the camera app.</p>
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (file) onCapture(file);
        }}
      />
      {live ? <JobsButton type="button" onClick={() => void snap()}>Take after photo</JobsButton> : null}
      {blocked ? <JobsButton type="button" onClick={() => fileRef.current?.click()}>Open camera</JobsButton> : null}
      <JobsButton type="button" variant="outline" onClick={onClose}>Back</JobsButton>
    </section>
  );
}
