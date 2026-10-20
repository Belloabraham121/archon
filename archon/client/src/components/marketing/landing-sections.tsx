"use client";

import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  DitherGradient,
  Grid,
  Line,
  LineChart,
  Radar,
  RadarChart,
  Sparkline,
  XAxis,
  YAxis,
  type ChartConfig,
} from "@/components/dither-kit";
import { Container } from "@/components/ui/container";

const howSteps = [
  {
    number: "01",
    label: "Ingest",
    title: "Normalize every financial event.",
    description:
      "Transactions, quotes, wallet state, chain conditions, and business context enter one versioned event model built for sustained high-volume processing.",
    stat: "1M events / min",
  },
  {
    number: "02",
    label: "Decide",
    title: "Rules first. Judgment only when needed.",
    description:
      "Deterministic policy clears the complete stream locally. Only the small ambiguous edge is batched and routed to Jev or another bounded judgment provider.",
    stat: "99.95% local path",
  },
  {
    number: "03",
    label: "Execute",
    title: "Validate the plan before value moves.",
    description:
      "Archon simulates routes, checks freshness and limits, records the decision trace, then submits the approved action to the target chain or venue.",
    stat: "One audit trail",
  },
] as const;

const ingestData = [
  { tick: "00", raw: 620, normalized: 590 },
  { tick: "10", raw: 760, normalized: 735 },
  { tick: "20", raw: 830, normalized: 810 },
  { tick: "30", raw: 910, normalized: 892 },
  { tick: "40", raw: 980, normalized: 965 },
  { tick: "50", raw: 1_030, normalized: 1_008 },
];

const ingestConfig = {
  raw: { label: "Inbound", color: "grey" },
  normalized: { label: "Normalized", color: "blue" },
} satisfies ChartConfig;

const decisionData = [
  { phase: "Policy", local: 999_400, judged: 0 },
  { phase: "Review", local: 0, judged: 420 },
  { phase: "Escalate", local: 0, judged: 180 },
];

const decisionConfig = {
  local: { label: "Deterministic", color: "orange" },
  judged: { label: "Bounded judgment", color: "blue" },
} satisfies ChartConfig;

const executionData = [
  { tick: "Quote", simulate: 72, execute: 0 },
  { tick: "Route", simulate: 84, execute: 38 },
  { tick: "Check", simulate: 93, execute: 66 },
  { tick: "Sign", simulate: 97, execute: 88 },
  { tick: "Final", simulate: 99, execute: 99 },
];

const executionConfig = {
  simulate: { label: "Validated", color: "green" },
  execute: { label: "Finalized", color: "purple" },
} satisfies ChartConfig;

const venueData = [
  { metric: "Price", routeA: 92, routeB: 76 },
  { metric: "Depth", routeA: 74, routeB: 94 },
  { metric: "Finality", routeA: 88, routeB: 72 },
  { metric: "Freshness", routeA: 96, routeB: 82 },
  { metric: "Risk", routeA: 79, routeB: 91 },
];

const venueConfig = {
  routeA: { label: "Route A", color: "orange" },
  routeB: { label: "Route B", color: "blue" },
} satisfies ChartConfig;

const chainData = [
  { chain: "Base", allowed: 84, review: 12 },
  { chain: "Sol", allowed: 96, review: 8 },
  { chain: "Hype", allowed: 73, review: 19 },
  { chain: "Tempo", allowed: 88, review: 10 },
];

const chainConfig = {
  allowed: { label: "Allowed", color: "green" },
  review: { label: "Review", color: "orange" },
} satisfies ChartConfig;

const revealTransition = {
  duration: 0.6,
  ease: [0.23, 1, 0.32, 1],
} as const;

export function LandingSections() {
  return (
    <div className="bg-[#050606] text-white">
      <HowItWorks />
      <Possibilities />
      <ScaleSection />
      <FinalCta />
    </div>
  );
}

function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const railTransformY = useTransform(
    scrollYProgress,
    [0, 1],
    ["scaleY(0.04)", "scaleY(1)"],
  );
  const railTransformX = useTransform(
    scrollYProgress,
    [0, 1],
    ["scaleX(0.04)", "scaleX(1)"],
  );

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const next = Math.min(howSteps.length - 1, Math.floor(progress * howSteps.length));
    setActiveStep((current) => (current === next ? current : next));
  });

  return (
    <section id="how-it-works" ref={sectionRef} className="relative scroll-mt-28 py-28 lg:py-40">
      <DitherGradient from="blue" to="transparent" direction="right" cell={5} opacity={0.12} bloom="low" className="h-[38rem]" />
      <Container className="relative z-10 max-w-[82rem]">
        <Reveal className="max-w-3xl">
          <p className="dark-eyebrow">How it works</p>
          <h2 className="mt-5 text-balance text-4xl font-medium leading-[1.02] tracking-[-0.05em] text-white/90 sm:text-6xl">
            A million decisions enter. Only the uncertain ones leave the fast path.
          </h2>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-white/43 sm:text-lg sm:leading-8">
            Archon is designed as a streaming system, not an API call per transaction.
            Deterministic policy remains local; probabilistic judgment is isolated,
            batched, cached, and replaceable.
          </p>
        </Reveal>

        <div className="mt-20 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div className="relative hidden lg:block">
            <div className="sticky top-28 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0a0b0b]/88 p-5 shadow-[0_28px_100px_rgb(0_0_0_/_45%)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                <div>
                  <p className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-white/30">Live decision stream</p>
                  <p className="mt-1 text-sm text-white/72">{howSteps[activeStep].label}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/38">
                  {howSteps[activeStep].stat}
                </span>
              </div>

              <div className="relative mt-4 h-[28rem] overflow-hidden rounded-2xl border border-white/[0.06] bg-black/35">
                <DitherGradient from={activeStep === 1 ? "orange" : activeStep === 2 ? "green" : "blue"} direction="up" cell={4} opacity={0.13} bloom="aura" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, transform: reduceMotion ? "none" : "translateY(16px)" }}
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={{ opacity: 0, transform: reduceMotion ? "none" : "translateY(-12px)" }}
                    transition={{ duration: reduceMotion ? 0.2 : 0.45, ease: [0.77, 0, 0.175, 1] }}
                    className="absolute inset-0 p-6"
                  >
                    <ProcessChart step={activeStep} animate={!reduceMotion} />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="relative h-px flex-1 overflow-hidden bg-white/10">
                  <motion.div
                    className="absolute inset-0 origin-left bg-[linear-gradient(90deg,#d79b5c,#b9efec)]"
                    style={{ transform: reduceMotion ? "scaleX(1)" : railTransformX }}
                  />
                </div>
                <span className="font-mono text-[0.58rem] tracking-[0.14em] text-white/30">0{activeStep + 1} / 03</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-[1.1rem] top-6 hidden h-[calc(100%-3rem)] w-px bg-white/[0.08] sm:block">
              <motion.div
                className="h-full origin-top bg-[linear-gradient(#79bdbc,#d3995d)]"
                style={{ transform: reduceMotion ? "scaleY(1)" : railTransformY }}
              />
            </div>
            {howSteps.map((step, index) => (
              <article
                key={step.number}
                className={`relative flex min-h-[25rem] flex-col justify-center rounded-[1.75rem] border p-7 transition-[background-color,border-color,opacity] duration-200 sm:pl-20 lg:min-h-[34rem] lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:pl-20 ${activeStep === index ? "border-white/14 bg-white/[0.035] opacity-100" : "border-white/[0.07] bg-white/[0.015] opacity-55"}`}
              >
                <span className="absolute left-6 top-8 hidden size-9 place-items-center rounded-full border border-white/12 bg-[#090a0a] font-mono text-[0.6rem] text-white/45 sm:grid lg:left-0 lg:top-1/2 lg:-translate-y-1/2">
                  {step.number}
                </span>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[#a7d9d7]">{step.label}</p>
                <h3 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.04em] text-white/90 sm:text-4xl">{step.title}</h3>
                <p className="mt-5 max-w-xl text-sm leading-7 text-white/42 sm:text-base">{step.description}</p>
                <div className="mt-8 h-20 overflow-hidden rounded-xl border border-white/[0.06] bg-black/30 p-3 lg:hidden">
                  <Sparkline
                    data={index === 0 ? [32, 46, 52, 70, 86, 98] : index === 1 ? [100, 98, 99, 97, 99, 100] : [28, 44, 67, 82, 96, 99]}
                    color={index === 1 ? "orange" : index === 2 ? "green" : "blue"}
                    variant={index === 1 ? "hatched" : "gradient"}
                    bloom="aura"
                    animate={!reduceMotion}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function ProcessChart({ step, animate }: { step: number; animate: boolean }) {
  if (step === 1) {
    return (
      <div className="h-full pt-8 text-white/30">
        <BarChart data={decisionData} config={decisionConfig} stackType="stacked" bloom="aura" animate={animate} animationDuration={900} interactive={false}>
          <Grid />
          <XAxis dataKey="phase" />
          <YAxis tickFormatter={(value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))} />
          <Bar dataKey="local" variant="hatched" />
          <Bar dataKey="judged" variant="gradient" />
        </BarChart>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="h-full pt-8 text-white/30">
        <LineChart data={executionData} config={executionConfig} bloom="aura" animate={animate} animationDuration={900} interactive={false}>
          <Grid />
          <XAxis dataKey="tick" />
          <YAxis tickFormatter={(value) => `${value}%`} />
          <Line dataKey="simulate" />
          <Line dataKey="execute" strokeVariant="dashed" />
        </LineChart>
      </div>
    );
  }

  return (
    <div className="h-full pt-8 text-white/30">
      <AreaChart data={ingestData} config={ingestConfig} bloom="aura" animate={animate} animationDuration={900} interactive={false}>
        <Grid />
        <XAxis dataKey="tick" />
        <YAxis tickFormatter={(value) => `${value}k`} />
        <Area dataKey="raw" variant="hatched" />
        <Area dataKey="normalized" variant="gradient" />
      </AreaChart>
    </div>
  );
}

function Possibilities() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="possibilities" className="relative scroll-mt-28 border-t border-white/[0.07] py-28 lg:py-40">
      <Container className="max-w-[82rem]">
        <Reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="dark-eyebrow">What becomes possible</p>
            <h2 className="mt-5 text-balance text-4xl font-medium leading-[1.02] tracking-[-0.05em] text-white/90 sm:text-6xl">
              One decision primitive. Many financial products.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-white/42 sm:text-base">
            The same policy, context, judgment, and validation pipeline can sit beneath agents, wallets, payment systems, and trading interfaces.
          </p>
        </Reveal>

        <div id="product" className="mt-16 grid gap-5 lg:grid-cols-2">
          <Reveal delay={0} className="group relative min-h-[31rem] overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0a0b0b] p-7 sm:p-9">
            <DitherGradient from="orange" to="transparent" direction="up" cell={4} opacity={0.12} bloom="aura" />
            <CardHeader eyebrow="Smart order routing" title="Choose the best execution, not merely the best quote." />
            <div className="relative mt-8 h-64 text-white/20">
              <RadarChart data={venueData} config={venueConfig} nameKey="metric" bloom="aura" animate={!reduceMotion} animationDuration={1000}>
                <Radar dataKey="routeA" variant="gradient" />
                <Radar dataKey="routeB" variant="hatched" />
              </RadarChart>
            </div>
          </Reveal>

          <Reveal delay={0.06} className="group relative min-h-[31rem] overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0a0b0b] p-7 sm:p-9">
            <DitherGradient from="blue" to="transparent" direction="left" cell={4} opacity={0.12} bloom="aura" />
            <CardHeader eyebrow="Agent treasuries" title="Let software spend within explicit operating boundaries." />
            <div className="relative mt-12 grid grid-cols-3 gap-3">
              {["Payroll", "Inventory", "Yield"].map((label, index) => (
                <div key={label} className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
                  <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-white/30">{label}</span>
                  <div className="mt-5 h-28">
                    <Sparkline data={index === 0 ? [4, 7, 6, 9, 11, 14] : index === 1 ? [9, 7, 10, 8, 13, 15] : [3, 5, 8, 8, 12, 16]} color={index === 2 ? "green" : "blue"} variant={index === 1 ? "dotted" : "gradient"} bloom="aura" animate={!reduceMotion} />
                  </div>
                </div>
              ))}
            </div>
            <p className="relative mt-8 max-w-md text-sm leading-6 text-white/38">Budgets, velocity limits, counterparties, approved assets, and escalation policy travel with every action.</p>
          </Reveal>

          <Reveal delay={0.12} className="group relative min-h-[31rem] overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0a0b0b] p-7 sm:p-9 lg:col-span-2">
            <DitherGradient from="green" to="orange" direction="right" cell={5} opacity={0.1} bloom="low" />
            <div className="relative grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
              <div className="lg:pb-8">
                <CardHeader eyebrow="Chain-agnostic policy" title="Express the intent once. Adapt execution to every venue." />
                <p className="mt-6 max-w-md text-sm leading-7 text-white/38">Base, Solana, Hyperliquid, Tempo, and future networks plug into adapters beneath the same decision contract.</p>
              </div>
              <div className="h-72 text-white/20 sm:h-80">
                <BarChart data={chainData} config={chainConfig} stackType="stacked" bloom="aura" animate={!reduceMotion} animationDuration={1000} interactive={false}>
                  <Grid />
                  <XAxis dataKey="chain" />
                  <YAxis />
                  <Bar dataKey="allowed" variant="gradient" />
                  <Bar dataKey="review" variant="hatched" />
                </BarChart>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function ScaleSection() {
  return (
    <section id="architecture" className="relative scroll-mt-28 border-t border-white/[0.07] py-28 lg:py-36">
      <DitherGradient from="purple" to="transparent" direction="up" cell={5} opacity={0.08} bloom="low" />
      <Container className="relative max-w-[82rem]">
        <Reveal className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="max-w-xl">
            <p className="dark-eyebrow">Built for the real stream</p>
            <h2 className="mt-5 text-balance text-4xl font-medium leading-[1.03] tracking-[-0.05em] text-white/90 sm:text-6xl">Intelligence is a lane, not a bottleneck.</h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2">
            {[
              ["Local fast path", "Policy evaluation is deterministic, horizontally scalable, and independent of model availability."],
              ["Batch judgment", "Similar ambiguous events share a bounded request instead of creating one external call per transaction."],
              ["Provider fallback", "Jev can run beside an alternate provider with circuit breakers, budgets, and confidence thresholds."],
              ["Replayable history", "Every decision is versioned so new rules can be tested against the original event stream."],
            ].map(([title, copy], index) => (
              <article key={title} className="bg-[#090a0a] p-7 sm:p-8">
                <span className="font-mono text-[0.58rem] text-white/25">0{index + 1}</span>
                <h3 className="mt-8 text-xl font-medium tracking-[-0.025em] text-white/82">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/38">{copy}</p>
              </article>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.07] py-28 text-center lg:py-40">
      <DitherGradient from="orange" to="blue" direction="up" cell={4} opacity={0.16} bloom="aura" />
      <Container className="relative z-10 max-w-4xl">
        <Reveal>
          <p className="dark-eyebrow">Build on Archon</p>
          <h2 className="mt-5 text-balance text-4xl font-medium leading-[1.02] tracking-[-0.05em] text-white/92 sm:text-6xl">Give every onchain action a reason.</h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-white/42">Start with programmable policy today. Add contextual judgment only where your product truly needs it.</p>
          <Link href="/dashboard" className="mt-9 inline-flex min-h-12 items-center gap-3 rounded-full border border-white/15 bg-white/[0.07] px-6 text-sm font-medium text-white/82 backdrop-blur-xl transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-white/25 hover:bg-white/[0.1] active:scale-[0.97]">
            Open the dashboard
            <span aria-hidden="true">↗</span>
          </Link>
        </Reveal>
      </Container>
    </section>
  );
}

function CardHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="relative max-w-xl">
      <p className="dark-eyebrow">{eyebrow}</p>
      <h3 className="mt-4 text-balance text-2xl font-medium leading-tight tracking-[-0.035em] text-white/88 sm:text-3xl">{title}</h3>
    </div>
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, transform: reduceMotion ? "none" : "translateY(24px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ ...revealTransition, delay: reduceMotion ? 0 : delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
