"use client";

import type { CSSProperties, ReactNode } from "react";

type ComandaCardProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

const WIDTH = 370;
const HEIGHT = 121;
const TOOTH = 10;
const TEETH_COUNT = Math.ceil(WIDTH / TOOTH);

function buildJaggedPath() {
  let d = `M0,0 L${WIDTH},0 L${WIDTH},${HEIGHT - TOOTH} `;

  let x = WIDTH;
  let goingDown = true;
  for (let i = 0; i < TEETH_COUNT; i++) {
    const nextX = x - TOOTH;
    const y = goingDown ? HEIGHT : HEIGHT - TOOTH;
    d += `L${nextX},${y} `;
    x = nextX;
    goingDown = !goingDown;
  }

  d += "L0,0 Z";
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
        width: WIDTH,
        height: HEIGHT,
        ...style,
      }}
    >
      {/* fundo com recorte serrilhado */}
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

      {/* conteúdo por cima do fundo */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}