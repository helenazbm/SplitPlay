"use client";

import type { CSSProperties, ReactNode } from "react";

type ComandaCardProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export default function ParticipantsComandaCard({
  className = "",
  style,
  children,
}: ComandaCardProps) {
  return (
    <div
      className={`relative bg-[#F7F5F4] border border-[#BCD0C3] rounded-t-[5px] ${className}`}
      style={{
        width: "370px",
        height: "121px",
        ...style,
      }}
    >
      {children}

      {/* linha serrilhada */}
      <div className="absolute bottom-0 left-0 right-0 h-[10px] overflow-hidden">
        <svg
          width="100%"
          height="10"
          viewBox="0 0 370 10"
          preserveAspectRatio="none"
          className="block h-full w-full"
        >
          <path
            d="
              M0,0
              L10,10
              L20,0
              L30,10
              L40,0
              L50,10
              L60,0
              L70,10
              L80,0
              L90,10
              L100,0
              L110,10
              L120,0
              L130,10
              L140,0
              L150,10
              L160,0
              L170,10
              L180,0
              L190,10
              L200,0
              L210,10
              L220,0
              L230,10
              L240,0
              L250,10
              L260,0
              L270,10
              L280,0
              L290,10
              L300,0
              L310,10
              L320,0
              L330,10
              L340,0
              L350,10
              L360,0
              L370,10
            "
            fill="none"
            stroke="#BCD0C3"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}