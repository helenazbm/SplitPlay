"use client";

import type { CSSProperties, ReactNode } from "react";

type ComandaCardProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

const WIDTH = 385;
const HEIGHT = 121;
const TOOTH_WIDTH = 10;
const TOOTH_HEIGHT = 5;

// 1 dente a mais para preencher melhor o corte
const TEETH_COUNT = Math.floor(WIDTH / TOOTH_WIDTH) + 1;

function buildJaggedPath() {
  let d = `M0,0 L${WIDTH},0 L${WIDTH},${HEIGHT - TOOTH_HEIGHT} `;

  let x = WIDTH;
  let goingDown = true;

  for (let i = 0; i < TEETH_COUNT; i++) {
    const nextX = x - TOOTH_WIDTH;
    const y = goingDown ? HEIGHT : HEIGHT - TOOTH_HEIGHT;

    d += `L${nextX},${y} `;
    x = nextX;
    goingDown = !goingDown;
  }

  // fechamento correto do lado esquerdo
  d += `L0,${HEIGHT} L0,0 Z`;

  return d;
}

export default function ParticipantsComandaCard({
  className = "",
  style,
  children,
}: ComandaCardProps) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        ...style,
      }}
    >
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 block"
      >
        <path
          d={buildJaggedPath()}
          fill="#F7F5F4"
          stroke="#BCD0C3"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>

      <div className="relative z-10">{children}</div>
    </div>
  );
}