'use client';

import { useState } from 'react';
import {
  Brain, Heart, Sparkles, Activity, ArrowRight, CheckCircle2, Info,
  ShieldCheck, Gauge, Layers, Bot, Play, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

interface Layer {
  id: number;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  desc: string;
  details: string[];
  color: string;
  accent: string;
  badgeBg: string;
}

const LAYERS: Layer[] = [
  {
    id: 1,
    title: 'Trust Framework',
    subtitle: 'The Empathetic Foundation',
    Icon: Heart,
    desc: 'The "why". Every persona is built on human oversight, ethics review and safeguarding protocols before it ever reaches a user.',
    details: [
      'Human-in-the-loop oversight',
      'Content integrity & safety profile',
      'Ethical interaction principles',
      'Audience-aware guardrails (B2B / B2C / B2G)',
    ],
    color: 'border-rose-500/40 bg-rose-950/20',
    accent: 'text-rose-400',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  {
    id: 2,
    title: 'Cognitive Scaffolding',
    subtitle: 'The Adaptive AI Engine',
    Icon: Brain,
    desc: 'The "how". A deep cognitive blueprint compiles identity, personality and communication style into one coherent system prompt, tuned per persona.',
    details: [
      'Structured cognitive blueprint compiler',
      'Interaction style & prompt-technique overrides',
      'Multi-provider model routing',
      'Real-time follow-up suggestion generation',
    ],
    color: 'border-brand-500/40 bg-brand-950/20',
    accent: 'text-brand-400',
    badgeBg: 'bg-brand-500/20 text-brand-300 border-brand-500/30',
  },
  {
    id: 3,
    title: 'Persona Systems',
    subtitle: 'The Narrative & Category Architecture',
    Icon: Sparkles,
    desc: 'The "what". 20 sector categories and dozens of specialist personas, each with its own voice, expertise and audience focus.',
    details: [
      'Sector-organised persona catalogue',
      'Distinct voice, tone & catchphrases per bot',
      'Business, consumer & public-sector variants',
      'Adaptive tone matched to each audience',
    ],
    color: 'border-accent-500/40 bg-accent-600/20',
    accent: 'text-accent-400',
    badgeBg: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
  },
];

const PRINCIPLES: { Icon: LucideIcon; title: string; desc: string }[] = [
  {
    Icon: ShieldCheck,
    title: 'Human-in-the-Loop',
    desc: 'Every persona blueprint is reviewed and editable by your team before it goes live in the catalogue.',
  },
  {
    Icon: Sparkles,
    title: 'Narrative-First Delivery',
    desc: 'Data and expertise are never shown raw — every reply arrives in the persona’s own distinct voice.',
  },
  {
    Icon: Gauge,
    title: 'Adaptive by Design',
    desc: 'Tone, depth and follow-ups respond in real time to the audience in front of the bot, not a fixed script.',
  },
  {
    Icon: Layers,
    title: 'Safety as Architecture',
    desc: 'Guardrails run beneath every layer of the organism, not bolted on top as an afterthought.',
  },
];

interface BionicOrganismProps {
  featuredPersonaHref?: string;
}

export function BionicOrganism({ featuredPersonaHref = '/personas' }: BionicOrganismProps) {
  const [activeLayer, setActiveLayer] = useState<number>(1);
  const [showLogicLoop, setShowLogicLoop] = useState(true);

  return (
    <div className="bg-slate-50 text-slate-900 selection:bg-brand-500/30 dark:bg-black dark:text-slate-100">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-white/10 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-black dark:via-slate-950 dark:to-black py-20 px-6 sm:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-20 top-0 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl animate-pulse" />
          <div className="absolute right-0 top-10 h-[26rem] w-[26rem] rounded-full bg-accent-500/25 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-rose-500/15 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-950/40 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-brand-400 shadow-lg shadow-brand-950/50">
            <Activity className="h-3.5 w-3.5 animate-pulse" /> Bionic Bot Architecture
          </div>

          <h1 className="font-extrabold uppercase tracking-tight text-4xl sm:text-6xl text-slate-900 dark:text-white leading-tight">
            The Bionic <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-accent-400 to-rose-400">Bot Organism</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base sm:text-lg font-normal leading-relaxed text-slate-600 dark:text-slate-300">
            Human trust &times; artificial intelligence &times; narrative craft — one integrated architecture behind
            every Freelee persona, tuned for business, consumer and public-sector audiences alike.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#organism-interactive"
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-accent-600 to-brand-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-brand shadow-lg shadow-accent-600/50 transition hover:scale-105 active:scale-95"
            >
              Explore The Merge <ArrowRight className="ml-2 h-4 w-4" />
            </a>

            <Link
              href={featuredPersonaHref}
              className="inline-flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-950/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:bg-slate-900 hover:text-slate-900 dark:text-white"
            >
              <Bot className="mr-2 h-4 w-4 text-brand-400" /> Meet the personas
            </Link>
          </div>
        </div>
      </section>

      {/* Interactive engine */}
      <section id="organism-interactive" className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black py-16 px-6 sm:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-brand-400">
              Interactive Bionic Core
            </p>
            <h2 className="text-3xl font-bold uppercase tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Three Systems. One Symbiotic Organism.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Intelligence without trust is cold. Trust without adaptive scale is limited. Our bionic architecture
              operates as one interconnected persona lifecycle.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-12 items-center justify-between">
            <div className="relative w-full lg:w-1/2 flex flex-col items-center justify-center py-6">
              <div className="relative w-80 h-80 sm:w-[420px] sm:h-[420px] flex-shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-slate-200 dark:border-white/10 animate-[spin_20s_linear_infinite]" />
                <div className="absolute inset-8 rounded-full border border-dashed border-slate-200 dark:border-white/10/80 animate-[spin_15s_linear_infinite_reverse]" />
                <div className="absolute inset-16 rounded-full border border-brand-500/10 animate-pulse" />

                <div className="absolute w-44 h-44 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl rounded-full flex flex-col items-center justify-center border border-accent-500/40 shadow-[0_0_50px_rgba(168,85,247,0.25)] z-10 group overflow-hidden p-4 text-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-500/10 via-brand-500/10 to-rose-500/10 animate-pulse" />
                  <Activity className="w-10 h-10 text-brand-400 mb-1 relative z-10 animate-bounce" />
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-900 dark:text-white relative z-10 leading-tight">
                    THE BIONIC
                    <br />
                    <span className="text-accent-400">MERGE</span>
                  </span>
                  <div className="mt-2 relative z-10">
                    <button
                      onClick={() => setShowLogicLoop(!showLogicLoop)}
                      className="text-[9px] font-bold uppercase tracking-wider bg-slate-100/90 dark:bg-slate-900/90 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-full border border-slate-300 dark:border-white/15 flex items-center gap-1 transition"
                    >
                      <Info className="w-2.5 h-2.5 text-brand-400" /> {showLogicLoop ? 'Hide Logic' : 'Show Logic'}
                    </button>
                  </div>
                </div>

                {LAYERS.map((layer, idx) => {
                  const angle = (idx * 360) / 3 - 90;
                  const radian = (angle * Math.PI) / 180;
                  const radius = 155;
                  const x = Math.cos(radian) * radius;
                  const y = Math.sin(radian) * radius;

                  return (
                    <button
                      key={layer.id}
                      onClick={() => setActiveLayer(layer.id)}
                      aria-label={layer.title}
                      className={`absolute w-20 h-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 z-20 overflow-hidden shadow-xl ${
                        activeLayer === layer.id
                          ? 'bg-white dark:bg-slate-950 border-2 border-brand-400 shadow-[0_0_30px_rgba(34,211,238,0.4)] scale-105'
                          : 'bg-white/90 dark:bg-slate-950/90 border border-slate-200 dark:border-white/10 backdrop-blur-md opacity-80 hover:opacity-100'
                      }`}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                    >
                      <layer.Icon className={`w-8 h-8 ${activeLayer === layer.id ? layer.accent : 'text-slate-500 dark:text-slate-400'}`} />
                      <span className="text-[9px] font-bold mt-1 text-slate-600 dark:text-slate-300 truncate max-w-[70px]">
                        {layer.title.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {showLogicLoop ? (
                <div className="mt-6 w-full max-w-md p-4 bg-white/90 dark:bg-slate-950/90 border border-slate-200 dark:border-white/10 rounded-2xl text-xs text-slate-600 dark:text-slate-300 shadow-xl backdrop-blur-md">
                  <p className="font-bold uppercase tracking-wider text-brand-400 text-[10px] mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Symbiotic Data Pipeline
                  </p>
                  <div className="space-y-2">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                      <span><strong>1. Cognitive Scaffolding:</strong> Blueprint compiled into a live system prompt</span>
                    </p>
                    <div className="h-2 w-0.5 bg-brand-500/30 ml-1.5" />
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span><strong>2. Trust Framework:</strong> Validated against safety & audience guardrails</span>
                    </p>
                    <div className="h-2 w-0.5 bg-rose-500/30 ml-1.5" />
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent-400 flex-shrink-0" />
                      <span><strong>3. Persona Systems:</strong> Delivered in the bot&apos;s own voice, with live follow-ups</span>
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="w-full lg:w-1/2 space-y-4">
              {LAYERS.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden group ${
                    activeLayer === layer.id
                      ? `${layer.color} shadow-2xl border-l-4`
                      : 'border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-950/40 hover:bg-white/80 dark:bg-slate-950/80 hover:border-slate-300 dark:border-white/15 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10">
                        <layer.Icon className={`w-6 h-6 ${layer.accent}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{layer.title}</h3>
                        <p className={`text-xs uppercase tracking-widest font-semibold ${layer.accent}`}>{layer.subtitle}</p>
                      </div>
                    </div>
                    {activeLayer === layer.id ? (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${layer.badgeBg}`}>
                        Active Focused Layer
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{layer.desc}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200 dark:border-white/10/60 pt-3">
                    {layer.details.map((detail) => (
                      <div key={detail} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <ArrowRight className={`w-3 h-3 ${layer.accent}`} />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-slate-100/60 dark:bg-slate-950/50 py-16 px-6 sm:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <p className="text-brand-400 font-mono text-xs font-bold uppercase tracking-widest mb-1">
              Ethical & Technological Foundations
            </p>
            <h2 className="text-3xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">Bionic Design Principles</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRINCIPLES.map((p, idx) => (
              <div
                key={p.title}
                className="p-6 rounded-2xl bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:border-white/15 transition duration-300 group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 flex items-center justify-center mb-4 text-brand-400 group-hover:text-accent-400 transition-colors">
                    <p.Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base mb-2 text-slate-900 dark:text-white">{p.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>PRINCIPLE 0{idx + 1}</span>
                  <CheckCircle2 className="w-3 h-3 text-brand-500/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Case study */}
      <section className="bg-slate-50 dark:bg-black py-16 px-6 sm:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-slate-100 via-slate-100 to-accent-500/20 dark:from-slate-950 dark:via-slate-950 dark:to-accent-600/40 border border-accent-500/30 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex-1 space-y-4 z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-500/20 border border-accent-500/30 text-xs font-bold text-accent-400 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Case Study
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                How the Bionic Loop Handles a Real Question
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                When a public-sector officer asks, <em className="text-brand-300 font-serif">&quot;How do I explain this policy change to residents?&quot;</em> —
                our <strong>Trust Framework</strong> checks the request against safety and audience guardrails, our{' '}
                <strong>Cognitive Scaffolding</strong> compiles the persona&apos;s blueprint and B2G tone into one system prompt,
                and our <strong>Persona Systems</strong> return a plain-language answer with clickable follow-up questions.
              </p>

              <div className="pt-2 flex flex-wrap gap-4">
                <Link
                  href={featuredPersonaHref}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-on-brand text-xs font-bold uppercase tracking-wider transition shadow-lg active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Try it in the chat
                </Link>
              </div>
            </div>

            <div className="w-full md:w-2/5 aspect-video rounded-2xl bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 p-6 flex flex-col justify-between relative group z-10 shadow-inner">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 pb-2">
                <span className="flex items-center gap-1.5 text-brand-400 font-bold">
                  <Activity className="w-3.5 h-3.5" /> BIONIC TRACE LOG
                </span>
                <span className="text-emerald-400">STATUS: LIVE</span>
              </div>

              <div className="space-y-2 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                <p><span className="text-rose-400">[Trust-Framework]:</span> Verified B2G tone & disclosure rules</p>
                <p><span className="text-brand-400">[Cognitive-Scaffold]:</span> Compiled blueprint + Socratic override</p>
                <p><span className="text-accent-400">[Persona-Systems]:</span> Generated 3 follow-up suggestions</p>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[10px] text-slate-500">
                <span>Response latency: 142ms</span>
                <span className="text-accent-400 font-semibold">Guardrails passed</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BionicOrganism;
