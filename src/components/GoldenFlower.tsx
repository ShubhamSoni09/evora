"use client";

import { useId } from "react";

/** Soft 5-petal blossom — rounded tips, visible gaps, reads as a flower at any size. */
export default function GoldenFlower({ size = 24 }: { size?: number }) {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  const petal = `pf${uid}`;

  // Rounded petal: narrow at hub, wide soft tip (classic blossom silhouette)
  const petalPath =
    "M16 15.8 C13.6 15.2 11.4 12.2 10.8 8.2 C10.4 5.4 12.6 2.8 16 2.2 C19.4 2.8 21.6 5.4 21.2 8.2 C20.6 12.2 18.4 15.2 16 15.8 Z";

  const angles = [0, 72, 144, 216, 288];

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" role="img">
      <defs>
        <linearGradient id={petal} x1="16" y1="2" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="55%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {angles.map((a) => (
        <path
          key={a}
          d={petalPath}
          fill={`url(#${petal})`}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="0.6"
          strokeLinejoin="round"
          transform={`rotate(${a} 16 16)`}
        />
      ))}
      <circle cx="16" cy="16" r="4.8" fill="#ea580c" />
      <circle cx="16" cy="16" r="4.2" fill="#f59e0b" />
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = (a * Math.PI) / 180;
        const x = 16 + Math.cos(rad) * 1.6;
        const y = 16 + Math.sin(rad) * 1.6;
        return <circle key={`s${a}`} cx={x} cy={y} r="0.55" fill="#fef3c7" opacity="0.9" />;
      })}
      <circle cx="14.8" cy="14.6" r="1" fill="white" opacity="0.45" />
    </svg>
  );
}
