"use client";

import Link from "next/link";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  showBadge?: boolean;
  href?: string;
}

export function LogoIcon({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimMap = {
    sm: "w-7 h-7",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${dimMap[size]} ${className}`}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_2px_8px_rgba(99,102,241,0.35)]"
      >
        <defs>
          <linearGradient id="tf-icon-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e1e24" />
            <stop offset="100%" stopColor="#0b0b0f" />
          </linearGradient>
          <linearGradient id="tf-icon-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient
            id="tf-icon-accent"
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Outer Squircle Container */}
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="8"
          fill="url(#tf-icon-bg)"
          stroke="url(#tf-icon-glow)"
          strokeWidth="1.5"
          strokeOpacity="0.8"
        />

        {/* Top T-Bar Flow Stream */}
        <path
          d="M7 9.5 C11 9.5, 14 7.5, 18 9 C22 10.5, 23 8.5, 25 8.5"
          stroke="url(#tf-icon-glow)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Vertical/Diagonal Intersecting Spine (T + F) */}
        <path
          d="M14 8.5 L14 23.5 C14 25, 15.5 25.5, 17 25"
          stroke="url(#tf-icon-glow)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Middle F-Branch Flow with Spark */}
        <path
          d="M14 16 C17 16, 19.5 14.5, 23 15.5"
          stroke="url(#tf-icon-accent)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Multi-Agent Gateway Nodes */}
        <circle cx="8" cy="9.5" r="1.5" fill="#c084fc" />
        <circle cx="24" cy="8.5" r="1.5" fill="#38bdf8" />
        <circle cx="22.5" cy="15.5" r="1.5" fill="#34d399" />
        <circle cx="17" cy="24.8" r="1.5" fill="#818cf8" />
      </svg>
    </div>
  );
}

export function Logo({
  className = "",
  size = "md",
  showText = true,
  showBadge = true,
  href = "/",
}: LogoProps) {
  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={size} />
      {showText && (
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <span className="font-bold text-white tracking-tight text-base sm:text-lg">
              TinyFlow
            </span>
            <span className="ml-1 px-1.5 py-0.2 rounded text-[11px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
              AI
            </span>
          </div>
          {showBadge && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-cyan-500/10 border border-indigo-500/20 text-indigo-300 font-mono hidden sm:inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Mozilla Otari
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="hover:opacity-90 transition-opacity focus:outline-none"
      >
        {content}
      </Link>
    );
  }

  return content;
}
