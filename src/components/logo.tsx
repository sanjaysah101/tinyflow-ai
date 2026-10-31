"use client";

import Image from "next/image";
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
  const pixelMap = {
    sm: 28,
    md: 32,
    lg: 40,
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-lg overflow-hidden border border-indigo-500/25 shadow-[0_2px_12px_rgba(99,102,241,0.3)] bg-[#070a12] p-0.5 ${dimMap[size]} ${className}`}
    >
      <Image
        src="/icon.png"
        alt="TinyFlow AI Logo"
        width={pixelMap[size]}
        height={pixelMap[size]}
        priority
        className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(139,92,246,0.4)]"
      />
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
