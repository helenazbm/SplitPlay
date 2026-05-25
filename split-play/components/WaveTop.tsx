"use client";

export default function WaveTop({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute left-0 right-0 z-30 w-full ${className}`}
      style={{
        top: "clamp(-3.5rem, -13cqi, -2.25rem)",
        height: "clamp(4rem, 20cqi, 5.5rem)",
      }}
    >
      <svg
        viewBox="0 0 420 90"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <path
          d="M 0 30 C 70 -6, 150 78, 230 34 C 300 0, 360 62, 420 20 L 420 90 L 0 90 Z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}
