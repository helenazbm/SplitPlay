"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type ComandaCardProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

const TOOTH_WIDTH = 10;
const TOOTH_HEIGHT = 5;

function buildJaggedPath(width: number, height: number) {
  if (width <= 0 || height <= 0) return "";

  const teethCount = Math.max(1, Math.floor(width / TOOTH_WIDTH) + 1);
  const toothWidth = width / teethCount;

  let d = `M0,0 L${width},0 L${width},${height - TOOTH_HEIGHT} `;

  let x = width;
  let goingDown = true;

  for (let i = 0; i < teethCount; i++) {
    const nextX = Math.max(0, x - toothWidth);
    const y = goingDown ? height : height - TOOTH_HEIGHT;

    d += `L${nextX},${y} `;
    x = nextX;
    goingDown = !goingDown;
  }

  d += `L0,${height} L0,0 Z`;

  return d;
}

export default function ParticipantsComandaCard({
  className = "",
  style,
  children,
}: ComandaCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const path = buildJaggedPath(size.width, size.height);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={style}
    >
      {size.width > 0 && size.height > 0 ? (
        <svg
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 block"
        >
          <path
            d={path}
            fill="#F7F5F4"
            stroke="#BCD0C3"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}

      <div className="relative z-10">{children}</div>
    </div>
  );
}