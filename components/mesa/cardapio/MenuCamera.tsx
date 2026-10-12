"use client";

import { useEffect, useRef, useState } from "react";

type Photo = { blob: Blob; url: string };

type MenuCameraProps = {
  maxPhotos: number;
  /** Leitura em andamento (a IA pode levar até ~1 min). */
  reading: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (photos: Blob[]) => void;
};

type CameraState = "starting" | "ready" | "unavailable";

/**
 * Câmera do cardápio (Figma): fundo escuro sobre a mesa, título "Cardápio",
 * moldura verde onde aparece a câmera e o disparador redondo embaixo. Junta
 * até `maxPhotos` fotos (cardápio de várias páginas) antes de mandar ler.
 * Sem câmera (desktop, permissão negada), o disparador abre a galeria.
 */
export default function MenuCamera({ maxPhotos, reading, error, onCancel, onSubmit }: MenuCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<Photo[]>([]);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // URLs de preview só são liberadas ao sair da tela.
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraState("ready");
      } catch {
        if (!cancelled) {
          setCameraState("unavailable");
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const full = photos.length >= maxPhotos;

  function addPhotos(blobs: Blob[]) {
    const room = maxPhotos - photosRef.current.length;
    const next = blobs.slice(0, Math.max(0, room)).map((blob) => ({ blob, url: URL.createObjectURL(blob) }));
    if (next.length > 0) {
      setPhotos((current) => [...current, ...next]);
    }
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url);
    setPhotos((current) => current.filter((photo) => photo.url !== url));
  }

  function capture() {
    if (full || reading) {
      return;
    }
    const video = videoRef.current;
    if (cameraState !== "ready" || !video || !video.videoWidth) {
      fileRef.current?.click();
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          addPhotos([blob]);
          setFlash(true);
          setTimeout(() => setFlash(false), 180);
        }
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div
      className="sp-fade-in fixed inset-0 z-[60] mx-auto flex w-full max-w-[420px] flex-col bg-[rgba(27,31,34,0.8)] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Fotografar ou enviar cardápio"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="relative shrink-0" style={{ padding: "40px 31px 0" }}>
        <h2 className="font-bagel" style={{ fontSize: "40px", lineHeight: 1.1 }}>
          Cardápio
        </h2>
        <p className="font-poppins font-thin" style={{ fontSize: "15px", maxWidth: "300px", marginTop: "6px" }}>
          Posicione o cardápio na câmera ou envie fotos que você já tem.
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={reading}
          aria-label="Fechar câmera"
          className="absolute flex items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
          style={{ top: "20px", right: "20px", height: "36px", width: "36px" }}
        >
          <i aria-hidden="true" className="pi pi-times" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center" style={{ gap: "14px", paddingBlock: "16px" }}>
        <div
          className="relative overflow-hidden rounded-[20px] border-2 border-[#347855] bg-[rgba(255,255,255,0.9)]"
          style={{ height: "min(44dvh, 368px)", aspectRatio: "217 / 307" }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover ${cameraState === "ready" ? "" : "hidden"}`}
          />

          {cameraState !== "ready" ? (
            <div
              className="font-poppins absolute inset-0 flex flex-col items-center justify-center text-center text-[#347855]"
              style={{ padding: "16px", gap: "8px", fontSize: "13px" }}
            >
              <i aria-hidden="true" className="pi pi-camera" style={{ fontSize: "28px" }} />
              {cameraState === "starting"
                ? "Abrindo a câmera..."
                : "Câmera indisponível. Toque no botão abaixo para escolher fotos do cardápio."}
            </div>
          ) : null}

          {flash ? <div aria-hidden="true" className="absolute inset-0 bg-white" /> : null}

          {reading ? (
            <div
              className="font-poppins absolute inset-0 flex flex-col items-center justify-center bg-[#1b1f22]/75 text-center"
              style={{ gap: "12px", padding: "16px", fontSize: "14px" }}
              role="status"
            >
              <i aria-hidden="true" className="pi pi-spin pi-spinner" style={{ fontSize: "28px" }} />
              Lendo o cardápio...
              <span className="font-thin" style={{ fontSize: "12px" }}>
                Pode levar até um minuto.
              </span>
            </div>
          ) : null}
        </div>

        {photos.length > 0 ? (
          <ul className="flex" style={{ gap: "10px" }} aria-label="Fotos tiradas">
            {photos.map((photo, index) => (
              <li key={photo.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={`Foto ${index + 1} do cardápio`}
                  className="rounded-[8px] border-2 border-[#ededed] object-cover"
                  style={{ height: "56px", width: "42px" }}
                />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.url)}
                  disabled={reading}
                  aria-label={`Remover foto ${index + 1}`}
                  className="absolute flex items-center justify-center rounded-full bg-[#da8280] text-white disabled:opacity-40"
                  style={{ top: "-6px", right: "-6px", height: "18px", width: "18px" }}
                >
                  <i aria-hidden="true" className="pi pi-times" style={{ fontSize: "8px" }} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="font-poppins rounded-[10px_10px_25px_10px] bg-[#fff7e7] text-center text-[#8a6d3b]"
            style={{ fontSize: "var(--text-fluid-xs)", padding: "10px 14px", marginInline: "31px" }}
          >
            {error}
          </p>
        ) : null}
      </div>

      <footer className="flex shrink-0 flex-col items-center" style={{ gap: "14px", paddingBottom: "40px" }}>
        {photos.length > 0 ? (
          <button
            type="button"
            data-cy="cardapio-ler"
            onClick={() => onSubmit(photos.map((photo) => photo.blob))}
            disabled={reading}
            className="font-poppins flex items-center justify-center rounded-full bg-[#519472] font-semibold text-[#f2f1f1] transition hover:bg-[#478464] disabled:opacity-50"
            style={{ height: "44px", paddingInline: "28px", fontSize: "13px", gap: "8px" }}
          >
            <i aria-hidden="true" className="pi pi-sparkles" />
            {photos.length === 1 ? "Ler cardápio" : `Ler cardápio (${photos.length} fotos)`}
          </button>
        ) : null}

        <div className="flex items-center" style={{ gap: "28px" }}>
          <span style={{ width: "56px" }} />
          <button
            type="button"
            onClick={capture}
            disabled={full || reading}
            aria-label={full ? `Limite de ${maxPhotos} fotos` : "Tirar foto"}
            className="flex items-center justify-center rounded-full border-4 border-[#ededed] transition active:scale-95 disabled:opacity-40"
            style={{ height: "80px", width: "80px" }}
          >
            <span className="block rounded-full bg-white" style={{ height: "60px", width: "60px" }} />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={full || reading}
            title="Enviar fotos da galeria"
            className="font-poppins flex flex-col items-center transition disabled:opacity-40"
            style={{ width: "56px", gap: "4px", fontSize: "11px" }}
          >
            <span
              className="flex items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
              style={{ height: "44px", width: "44px" }}
            >
              <i aria-hidden="true" className="pi pi-upload" />
            </span>
            Enviar
          </button>
        </div>
        <p className="font-poppins font-thin" style={{ fontSize: "12px" }}>
          {full ? `Limite de ${maxPhotos} fotos por leitura.` : `Até ${maxPhotos} fotos (câmera ou enviadas), uma por página.`}
        </p>
      </footer>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={cameraState === "unavailable" ? "environment" : undefined}
        multiple
        className="hidden"
        onChange={(event) => {
          addPhotos(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </div>
  );
}
