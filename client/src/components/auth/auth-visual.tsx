"use client";

import { useReducedMotion } from "motion/react";

import {
  DitherGradient,
  Line,
  LineChart,
  type ChartConfig,
} from "@/components/dither-kit";
import { BrandLogo } from "@/components/brand/brand-logo";

const signalData = [
  { t: 0, policy: 24, judgment: 10, execution: 18 },
  { t: 1, policy: 38, judgment: 18, execution: 24 },
  { t: 2, policy: 31, judgment: 15, execution: 36 },
  { t: 3, policy: 54, judgment: 28, execution: 43 },
  { t: 4, policy: 49, judgment: 22, execution: 58 },
  { t: 5, policy: 72, judgment: 38, execution: 66 },
  { t: 6, policy: 68, judgment: 31, execution: 82 },
  { t: 7, policy: 91, judgment: 45, execution: 88 },
  { t: 8, policy: 86, judgment: 36, execution: 96 },
];

const signalConfig = {
  policy: { label: "Policy", color: "blue" },
  judgment: { label: "Judgment", color: "orange" },
  execution: { label: "Execution", color: "green" },
} satisfies ChartConfig;

type AuthVisualProps = {
  mode: "login" | "signup";
};

export function AuthVisual({ mode }: AuthVisualProps) {
  const reduceMotion = useReducedMotion();

  return (
    <aside className="relative hidden min-h-svh overflow-hidden border-r border-white/[0.07] bg-[#050606] text-white lg:block">
      <DitherGradient
        from="blue"
        to="orange"
        direction="right"
        cell={4}
        opacity={0.22}
        bloom="aura"
      />

      <div className="absolute left-8 top-7 z-30">
        <BrandLogo inverse priority />
      </div>

      <div className="auth-chart-plane absolute -left-[12%] top-[11%] z-10 h-[68%] w-[128%] text-white/15">
        <LineChart
          data={signalData}
          config={signalConfig}
          bloom="aura"
          animate={!reduceMotion}
          animationDuration={1200}
          interactive={false}
          margins={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Line dataKey="policy" />
          <Line dataKey="judgment" strokeVariant="dashed" />
          <Line dataKey="execution" />
        </LineChart>
      </div>

      <div className="absolute bottom-10 left-10 right-10 z-30 border-t border-white/[0.1] pt-7 xl:bottom-12 xl:left-12 xl:right-12">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.17em] text-white/36">
            Live decision stream
          </p>
          <span className="font-mono text-[0.58rem] text-[#a9dcda]">1M / min</span>
        </div>
        <p className="mt-7 text-sm text-white/48">
          {mode === "signup" ? "Programmable execution starts here." : "Your decision infrastructure is waiting."}
        </p>
        <h2 className="mt-2 max-w-xl text-balance text-3xl font-medium leading-tight tracking-[-0.04em] text-white/90 xl:text-4xl">
          One policy layer. Every onchain action.
        </h2>
      </div>
    </aside>
  );
}
