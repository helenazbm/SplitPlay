"use client";

import type { CSSProperties, ReactNode } from "react";

type ComandaCardProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

const WIDTH = 370;
const HEIGHT = 121;
const TOOTH_WIDTH = 10;
const TOOTH_HEIGHT = 5;
const TEETH_COUNT = Math.ceil(WIDTH / TOOTH_WIDTH);

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
        width: "370px",
        height: "121px",
        ...style,
      }}
    >
      {/* fundo com recorte serrilhado */}
      <svg
        width={"370px"}
        height={"121px"}
        viewBox={`0 0 370px 121px`}
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