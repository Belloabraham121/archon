import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/ui/container";

export function Hero() {
  return (
    <section className="relative isolate min-h-[calc(100svh-var(--header-height))] overflow-hidden bg-[#050606] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_-35%,rgb(255_255_255_/_10%),transparent_68%)]"
      />

      <Container className="relative z-20 flex min-h-[calc(100svh-var(--header-height))] max-w-[96rem] flex-col items-center px-5 text-center sm:px-8">
        <div className="flex w-full max-w-5xl flex-col items-center pb-[23rem] pt-20 sm:pb-[27rem] sm:pt-24 lg:pt-28">
          <div className="flex items-center gap-2 font-mono text-[0.6rem] font-medium uppercase tracking-[0.2em] text-white/45 sm:text-[0.66rem]">
            <span>Powered by</span>
            <span className="text-white/70">policy</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-[#d59a5c] shadow-[0_0_12px_#d59a5c]" />
            <span className="text-white/70">context</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-[#8bd6d5] shadow-[0_0_12px_#8bd6d5]" />
            <span className="text-white/70">judgment</span>
          </div>

          <h1 className="mt-8 max-w-[18ch] bg-[linear-gradient(105deg,#777_2%,#f4f4f1_48%,#898989_96%)] bg-clip-text text-balance text-[clamp(3rem,6.4vw,6.3rem)] font-medium leading-[0.96] tracking-[-0.065em] text-transparent">
            The decision layer for onchain execution.
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-sm leading-6 text-white/42 sm:text-base sm:leading-7">
            Archon evaluates every transaction against live context, routes the
            rare ambiguous case through bounded judgment, and validates the
            result before it moves onchain.
          </p>

          <Link
            href="/signup"
            className="mt-8 inline-flex min-h-11 items-center gap-3 rounded-sm border border-white/10 bg-[linear-gradient(180deg,#202222,#111212)] px-5 text-xs font-medium text-white/80 shadow-[inset_0_1px_rgb(255_255_255_/_7%),0_12px_40px_rgb(0_0_0_/_40%)] transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
          >
            Start building
            <ArrowRightIcon />
          </Link>
        </div>
      </Container>

      <DecisionRibbon />
      <DecisionPanel />
    </section>
  );
}

function DecisionRibbon() {
  const lines = Array.from({ length: 22 }, (_, index) => index);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 h-[24rem] sm:bottom-28 sm:h-[29rem] lg:bottom-24 lg:h-[34rem]">
      <svg
        aria-hidden="true"
        className="h-full w-full"
        viewBox="0 0 1600 560"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ribbon-stroke" x1="0" x2="1">
            <stop offset="0" stopColor="#344348" stopOpacity="0" />
            <stop offset="0.18" stopColor="#7a9397" stopOpacity="0.58" />
            <stop offset="0.38" stopColor="#d59655" stopOpacity="0.74" />
            <stop offset="0.57" stopColor="#d9f4f1" stopOpacity="0.9" />
            <stop offset="0.76" stopColor="#73b8b7" stopOpacity="0.64" />
            <stop offset="0.91" stopColor="#d28b4c" stopOpacity="0.56" />
            <stop offset="1" stopColor="#1d282b" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ribbon-fill" x1="0" x2="1">
            <stop offset="0" stopColor="#0a1012" stopOpacity="0" />
            <stop offset="0.35" stopColor="#9d6536" stopOpacity="0.16" />
            <stop offset="0.58" stopColor="#c7f2ef" stopOpacity="0.15" />
            <stop offset="0.82" stopColor="#976038" stopOpacity="0.12" />
            <stop offset="1" stopColor="#081012" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="node-cool">
            <stop offset="0" stopColor="#f1ffff" />
            <stop offset="0.28" stopColor="#a9e5e2" />
            <stop offset="1" stopColor="#77b7b4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="node-warm">
            <stop offset="0" stopColor="#fff3dc" />
            <stop offset="0.3" stopColor="#d89c61" />
            <stop offset="1" stopColor="#d89c61" stopOpacity="0" />
          </radialGradient>
          <filter id="soft-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        <path
          d="M-80 420 C150 430 255 385 420 360 C620 330 665 160 850 170 C1035 180 1070 350 1265 340 C1405 333 1500 280 1680 310 L1680 560 L-80 560 Z"
          fill="url(#ribbon-fill)"
        />

        {lines.map((line) => {
          const offset = line * 8;
          return (
            <path
              key={line}
              d={`M-100 ${430 + offset * 0.35} C170 ${438 + offset * 0.2} 280 ${390 + offset * 0.1} 450 ${360 + offset * 0.08} C625 ${330 + offset * 0.06} 680 ${170 + offset * 0.1} 850 ${175 + offset * 0.1} C1020 ${180 + offset * 0.08} 1090 ${350 + offset * 0.08} 1270 ${340 + offset * 0.08} C1420 ${332 + offset * 0.14} 1515 ${282 + offset * 0.22} 1700 ${310 + offset * 0.28}`}
              fill="none"
              stroke="url(#ribbon-stroke)"
              strokeOpacity={0.72 - line * 0.022}
              strokeWidth="1.1"
            />
          );
        })}

        <path
          d="M-80 422 C155 430 260 385 420 360 C620 330 665 160 850 170 C1035 180 1070 350 1265 340 C1410 333 1505 280 1680 310"
          fill="none"
          stroke="url(#ribbon-stroke)"
          strokeWidth="2.6"
        />

        <g opacity="0.9">
          <circle cx="425" cy="358" r="32" fill="url(#node-warm)" filter="url(#soft-glow)" />
          <circle cx="425" cy="358" r="7" fill="#f2c391" />
          <circle cx="850" cy="170" r="36" fill="url(#node-cool)" filter="url(#soft-glow)" />
          <circle cx="850" cy="170" r="7" fill="#c8f1ef" />
          <circle cx="1265" cy="340" r="32" fill="url(#node-warm)" filter="url(#soft-glow)" />
          <circle cx="1265" cy="340" r="7" fill="#e9b47e" />
        </g>
      </svg>
    </div>
  );
}

function DecisionPanel() {
  return (
    <div className="absolute -bottom-24 left-1/2 z-30 w-[min(92%,46rem)] -translate-x-1/2 rounded-t-2xl border border-b-0 border-white/[0.07] bg-[#080a0a]/92 px-6 pb-28 pt-8 text-center shadow-[0_-20px_80px_rgb(0_0_0_/_62%)] backdrop-blur-xl sm:-bottom-20 sm:px-12 sm:pb-28 sm:pt-10">
      <Image
        src="/brand/archon-wordmark.svg"
        width={156}
        height={56}
        alt="Archon"
        className="mx-auto h-auto w-32 brightness-0 invert sm:w-36"
      />
      <p className="mx-auto mt-5 max-w-xl text-pretty text-xs leading-5 text-white/40 sm:text-sm sm:leading-6">
        One programmable layer for policy, probabilistic judgment, smart routing,
        and verifiable execution across chains.
      </p>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-3 border-y border-white/[0.07] py-4 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-white/35 sm:text-[0.62rem]">
        <span>Decide</span>
        <span>Validate</span>
        <span>Execute</span>
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3 7h7.5M7.5 4l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
