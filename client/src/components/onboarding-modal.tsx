import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  X, ChefHat, Briefcase, Megaphone, Headphones, DollarSign, Scale,
  ClipboardList, MessageSquare, ChevronLeft, ChevronRight,
  TrendingUp, Star, Clock, BarChart3, Sparkles, Zap, ShoppingBag, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";


// ─── Slide 0 — Chat typewriter animation ───────────────────────────────────────

function useTypewriter(phrases: string[]) {
  const [text, setText] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting" | "gap">("typing");

  useEffect(() => {
    const phrase = phrases[phraseIdx];
    let t: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (text.length < phrase.length) {
        t = setTimeout(() => setText(phrase.slice(0, text.length + 1)), 40);
      } else {
        t = setTimeout(() => setPhase("pausing"), 1000);
      }
    } else if (phase === "pausing") {
      t = setTimeout(() => setPhase("deleting"), 0);
    } else if (phase === "deleting") {
      if (text.length > 0) {
        t = setTimeout(() => setText(text.slice(0, -1)), 18);
      } else {
        t = setTimeout(() => {
          setPhraseIdx((i) => (i + 1) % phrases.length);
          setPhase("gap");
        }, 0);
      }
    } else {
      t = setTimeout(() => setPhase("typing"), 480);
    }

    return () => clearTimeout(t);
  }, [text, phase, phraseIdx, phrases]);

  return text;
}

function Slide0Hero() {
  const { t } = useTranslation();
  const CHAT_PHRASES = [
    t("onboarding.chat_phrase1"),
    t("onboarding.chat_phrase2"),
    t("onboarding.chat_phrase3"),
  ];
  const text = useTypewriter(CHAT_PHRASES);

  return (
    <div
      className="relative h-[280px] flex-shrink-0 overflow-hidden flex items-center justify-center px-8"
      style={{ background: "linear-gradient(135deg, #060b18 0%, #0e1e36 55%, #08111f 100%)" }}
    >
      {/* Ambient glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-28 rounded-full bg-blue-500/12 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/3 w-24 h-24 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

      <div className="w-full max-w-[420px] flex flex-col gap-4">
        {/* AI chat bubble */}
        <div className="flex items-end gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl rounded-bl-sm px-4 py-2.5">
            <p className="text-sm text-white/80 leading-relaxed">{t("onboarding.slide0_ai_greeting")}</p>
          </div>
        </div>

        {/* Input box — focal point */}
        <div
          className="relative flex items-center gap-3 rounded-2xl border border-white/20 px-4 py-3.5"
          style={{
            background: "rgba(255,255,255,0.07)",
            boxShadow: "0 0 0 2px rgba(96,165,250,0.25), 0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex-1 min-w-0">
            <span className="text-sm text-white font-medium leading-none tracking-wide">
              {text}
            </span>
            <span
              className="inline-block w-[2px] h-[15px] bg-blue-400 ml-[2px] align-middle"
              style={{ animation: "pulse 1s step-start infinite" }}
            />
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            <Send className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide0Body({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const chatExamples = [
    { phrase: t("onboarding.slide0_example1_phrase"), result: t("onboarding.slide0_example1_result") },
    { phrase: t("onboarding.slide0_example2_phrase"), result: t("onboarding.slide0_example2_result") },
    { phrase: t("onboarding.slide0_example3_phrase"), result: t("onboarding.slide0_example3_result") },
  ];
  return (
    <div className="flex flex-col gap-5 h-full">
      <span className="self-start text-sm font-bold tracking-widest uppercase bg-foreground/10 text-foreground px-2.5 py-1 rounded-full">
        {t("onboarding.slide0_badge")}
      </span>
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground leading-tight">
          {t("onboarding.slide0_h2")}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {t("onboarding.slide0_desc")}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {chatExamples.map(({ phrase, result }) => (
          <div key={phrase} className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{phrase}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{result}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="mt-auto w-full bg-foreground text-background text-sm font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
        data-testid="button-onboarding-chat-next"
      >
        {t("onboarding.slide0_cta")}
      </button>
    </div>
  );
}

// ─── Slide 1 — Hero visual ─────────────────────────────────────────────────────

function Slide1Hero() {
  const { t } = useTranslation();
  const AGENTS = [
    { icon: ChefHat,     label: t("onboarding.agent_chef"),       accent: "from-amber-500 to-orange-500",   ring: "ring-amber-400/40" },
    { icon: Briefcase,   label: t("onboarding.agent_operations"), accent: "from-blue-500 to-indigo-500",    ring: "ring-blue-400/40" },
    { icon: Megaphone,   label: t("onboarding.agent_marketing"),  accent: "from-purple-500 to-fuchsia-500", ring: "ring-purple-400/40" },
    { icon: Headphones,  label: t("onboarding.agent_customer"),   accent: "from-teal-500 to-cyan-500",      ring: "ring-teal-400/40" },
    { icon: DollarSign,  label: t("onboarding.agent_finance"),    accent: "from-emerald-500 to-green-500",  ring: "ring-emerald-400/40" },
    { icon: Scale,       label: t("onboarding.agent_legal"),      accent: "from-violet-500 to-purple-600",  ring: "ring-violet-400/40" },
  ];
  const METRICS = [
    { value: "+18%", label: t("onboarding.metric_order_growth"),   icon: TrendingUp, bg: "bg-green-500/20",  txt: "text-green-300" },
    { value: "3.1×", label: t("onboarding.metric_delivery_roas"),  icon: BarChart3,  bg: "bg-blue-500/20",   txt: "text-blue-300" },
    { value: "4.8★", label: t("onboarding.metric_avg_rating"),     icon: Star,       bg: "bg-amber-500/20",  txt: "text-amber-300" },
    { value: "24/7", label: t("onboarding.metric_always_running"), icon: Clock,      bg: "bg-violet-500/20", txt: "text-violet-300" },
  ];

  return (
    <div
      className="relative h-[280px] flex-shrink-0 overflow-hidden flex flex-col items-center justify-center px-8"
      style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a1040 50%, #0f1a2e 100%)" }}
    >
      {/* Glow blobs */}
      <div className="absolute top-4 left-1/4 w-40 h-40 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />

      {/* Agent circles */}
      <div className="flex gap-3 mb-3">
        {AGENTS.slice(0, 3).map(({ icon: Icon, label, accent, ring }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div className={cn(
              "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center ring-2",
              accent, ring
            )}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-white/60 font-medium">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        {AGENTS.slice(3).map(({ icon: Icon, label, accent, ring }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div className={cn(
              "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center ring-2",
              accent, ring
            )}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-white/60 font-medium">{label}</span>
          </div>
        ))}
      </div>

      {/* Live pulse indicator */}
      <div className="absolute top-3 left-4 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-sm text-green-400 font-semibold">{t("onboarding.live_label")}</span>
      </div>

      {/* Metrics grid — 2x2 — shown in hero for visual richness */}
      <div className="absolute bottom-3 right-3 grid grid-cols-2 gap-1.5 opacity-0 pointer-events-none" aria-hidden>
        {METRICS.map(({ value, label, icon: Icon, bg, txt }) => (
          <div key={label} className={cn("rounded-lg px-2 py-1 flex flex-col items-center text-center text-[9px]", bg)}>
            <Icon className={cn("w-3 h-3 mb-0.5", txt)} />
            <p className={cn("font-bold leading-none", txt)}>{value}</p>
            <p className="text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Slide 2 — Hero visual ─────────────────────────────────────────────────────

function Slide2Hero() {
  const { t } = useTranslation();
  const TASK_PREVIEWS = [
    { label: t("onboarding.task_preview1_label"), tag: t("onboarding.agent_chef"),      tw: "bg-amber-500/90" },
    { label: t("onboarding.task_preview2_label"), tag: t("onboarding.agent_marketing"), tw: "bg-purple-500/90" },
    { label: t("onboarding.task_preview3_label"), tag: t("onboarding.agent_customer"),  tw: "bg-teal-500/90" },
  ];
  return (
    <div
      className="relative h-[280px] flex-shrink-0 overflow-hidden flex flex-col justify-center px-8 gap-3"
      style={{ background: "linear-gradient(135deg, #1a0533 0%, #2d1065 50%, #0d1a3a 100%)" }}
    >
      <div className="absolute top-6 right-8 w-32 h-32 rounded-full bg-fuchsia-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-2 left-8 w-28 h-28 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />

      {/* ShoppingBag icon watermark */}
      <div className="absolute top-4 left-4 opacity-10">
        <ShoppingBag className="w-20 h-20 text-white" />
      </div>

      {TASK_PREVIEWS.map(({ label, tag, tw }) => (
        <div key={label} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
          <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span className="text-sm text-white/90 font-medium flex-1 truncate">{label}</span>
          <span className={cn("text-sm font-bold px-2 py-0.5 rounded-full text-white", tw)}>{tag}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Slide 3 — Hero visual ─────────────────────────────────────────────────────

function Slide3Hero() {
  const { t } = useTranslation();
  return (
    <div
      className="relative h-[280px] flex-shrink-0 overflow-hidden flex flex-col items-center justify-center gap-4"
      style={{ background: "linear-gradient(135deg, #0d1f12 0%, #1a3a2a 50%, #1a1a2e 100%)" }}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-5">
        <Sparkles className="w-64 h-64 text-white" />
      </div>
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center ring-4 ring-emerald-400/20">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-white">{t("onboarding.slide3_hero_title")}</p>
        <p className="text-sm text-white/50 mt-1">{t("onboarding.slide3_hero_sub")}</p>
      </div>
    </div>
  );
}

// ─── Slide bodies ──────────────────────────────────────────────────────────────

function Slide1Body({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const METRICS = [
    { value: "+18%", label: t("onboarding.metric_order_growth"),   icon: TrendingUp, bg: "bg-green-500/20",  txt: "text-green-300" },
    { value: "3.1×", label: t("onboarding.metric_delivery_roas"),  icon: BarChart3,  bg: "bg-blue-500/20",   txt: "text-blue-300" },
    { value: "4.8★", label: t("onboarding.metric_avg_rating"),     icon: Star,       bg: "bg-amber-500/20",  txt: "text-amber-300" },
    { value: "24/7", label: t("onboarding.metric_always_running"), icon: Clock,      bg: "bg-violet-500/20", txt: "text-violet-300" },
  ];
  return (
    <div className="flex flex-col gap-5 h-full">
      <span className="self-start text-sm font-bold tracking-widest uppercase bg-foreground/10 text-foreground px-2.5 py-1 rounded-full">
        {t("onboarding.slide1_badge")}
      </span>
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground leading-tight">
          {t("onboarding.slide1_h2")}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {t("onboarding.slide1_desc")}
        </p>
      </div>

      {/* Metrics grid — 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map(({ value, label, icon: Icon, bg, txt }) => (
          <div key={label} className={cn("rounded-xl p-4 flex flex-col items-center gap-2 text-center", bg)}>
            <Icon className={cn("w-5 h-5", txt)} />
            <p className={cn("text-2xl font-bold leading-none", txt)}>{value}</p>
            <p className="text-sm text-muted-foreground leading-tight">{label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="mt-auto w-full bg-foreground text-background text-sm font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
        data-testid="button-onboarding-explore-agents"
      >
        {t("onboarding.slide1_cta")}
      </button>
    </div>
  );
}

function Slide2Body({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const handle = () => { onClose(); navigate("/admin/task-market"); };

  const TASKS_FULL = [
    {
      icon: ClipboardList,
      title: t("onboarding.task1_title"),
      desc: t("onboarding.task1_desc"),
      tag: t("onboarding.agent_chef"),
      tagBg: "bg-amber-100 text-amber-700",
      iconBg: "bg-amber-50 text-amber-600",
    },
    {
      icon: Megaphone,
      title: t("onboarding.task2_title"),
      desc: t("onboarding.task2_desc"),
      tag: t("onboarding.agent_marketing"),
      tagBg: "bg-purple-100 text-purple-700",
      iconBg: "bg-purple-50 text-purple-600",
    },
    {
      icon: MessageSquare,
      title: t("onboarding.task3_title"),
      desc: t("onboarding.task3_desc"),
      tag: t("onboarding.agent_customer"),
      tagBg: "bg-teal-100 text-teal-700",
      iconBg: "bg-teal-50 text-teal-600",
    },
  ];

  return (
    <div className="flex flex-col gap-5 h-full">
      <span className="self-start text-sm font-bold tracking-widest uppercase bg-foreground/10 text-foreground px-2.5 py-1 rounded-full">
        {t("onboarding.slide2_badge")}
      </span>
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground leading-tight">
          {t("onboarding.slide2_h2")}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {t("onboarding.slide2_desc")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {TASKS_FULL.map(({ icon: Icon, title, desc, tag, tagBg, iconBg }) => (
          <div key={title} className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", iconBg)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <span className={cn("text-sm font-bold px-2 py-0.5 rounded-full flex-shrink-0", tagBg)}>{tag}</span>
          </div>
        ))}
      </div>

      <button
        onClick={handle}
        className="mt-auto w-full bg-foreground text-background text-sm font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
        data-testid="button-onboarding-go-task-market"
      >
        {t("onboarding.slide2_cta")}
      </button>
    </div>
  );
}

function Slide3Body() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      <span className="self-center text-sm font-bold tracking-widest uppercase bg-foreground/10 text-foreground px-2.5 py-1 rounded-full">
        {t("onboarding.slide3_badge")}
      </span>
      <h2 className="font-serif text-2xl font-bold text-foreground">{t("onboarding.slide3_h2")}</h2>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {t("onboarding.slide3_desc")}
      </p>
    </div>
  );
}

// ─── Main modal ────────────────────────────────────────────────────────────────

const TOTAL_SLIDES = 4;
const SLIDE_HEROES = [Slide0Hero, Slide1Hero, Slide2Hero, Slide3Hero];
const SLIDE_BODIES = [
  (props: { onNext: () => void; onClose: () => void }) => <Slide0Body onNext={props.onNext} />,
  (props: { onNext: () => void; onClose: () => void }) => <Slide1Body onNext={props.onNext} />,
  (props: { onNext: () => void; onClose: () => void }) => <Slide2Body onClose={props.onClose} />,
  () => <Slide3Body />,
];

export default function OnboardingModal({ debugOpen, onDebugClose }: { debugOpen?: boolean; onDebugClose?: () => void } = {}) {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);
  const [transSlide, setTransSlide] = useState<number | null>(null);
  const [transDir, setTransDir] = useState<"left" | "right">("left");
  const [transActive, setTransActive] = useState(false);
  const [noTransition, setNoTransition] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionStorage.getItem("favie_onboarding_dismissed")) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (debugOpen) {
      setVisible(true);
      setSlide(0);
    }
  }, [debugOpen]);

  const closeSession = () => {
    sessionStorage.setItem("favie_onboarding_dismissed", "1");
    setVisible(false);
    onDebugClose?.();
  };

  const goTo = (next: number) => {
    if (transSlide !== null || next === slide || next < 0 || next >= TOTAL_SLIDES) return;
    setTransDir(next > slide ? "left" : "right");
    setTransSlide(next);
    // Double rAF: first frame paints the entering slide off-screen, second starts the CSS transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransActive(true);
        setTimeout(() => {
          // 1. Disable transition so the current panel doesn't animate back to 0
          setNoTransition(true);
          requestAnimationFrame(() => {
            // 2. Snap the current panel to new content at position 0 (no visual change — it's off-screen)
            setSlide(next);
            setTransSlide(null);
            setTransActive(false);
            requestAnimationFrame(() => {
              // 3. Re-enable transitions for next interaction
              setNoTransition(false);
            });
          });
        }, 320);
      });
    });
  };

  const prev = () => goTo(slide - 1);
  const next = () => goTo(slide + 1);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 50) { dx > 0 ? next() : prev(); }
    touchStartX.current = null;
  };

  if (!visible) return null;

  const transitioning = transSlide !== null;
  const activeSlide = transSlide ?? slide;

  const CurHero = SLIDE_HEROES[slide];
  const CurBody = SLIDE_BODIES[slide];
  const InHero  = transSlide !== null ? SLIDE_HEROES[transSlide] : null;
  const InBody  = transSlide !== null ? SLIDE_BODIES[transSlide] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-10"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      data-testid="onboarding-modal-overlay"
    >
      <div className="flex items-center gap-3 w-full max-w-[860px]">

        {/* Left arrow */}
        <button
          onClick={prev}
          disabled={activeSlide === 0}
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white transition-all",
            activeSlide === 0 ? "opacity-20 cursor-not-allowed" : "hover:bg-white/25"
          )}
          aria-label="Previous slide"
          data-testid="button-onboarding-prev"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Card */}
        <div
          className="relative flex-1 flex flex-col bg-card rounded-2xl overflow-hidden shadow-2xl"
          style={{ height: 800 }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          data-testid="onboarding-modal-card"
        >
          {/* Close */}
          <button
            onClick={closeSession}
            className="absolute top-4 right-4 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
            aria-label="Close"
            data-testid="button-onboarding-close"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Slide track — relative container, both panels absolute inside */}
          <div className="relative flex-1 overflow-hidden">

            {/* Current slide (exits) */}
            <div className={cn(
              "absolute inset-0 flex flex-col",
              !noTransition && "transition-transform duration-300 ease-in-out",
              transActive
                ? (transDir === "left" ? "-translate-x-full" : "translate-x-full")
                : "translate-x-0"
            )}>
              <CurHero />
              <div className="flex-1 overflow-hidden px-8 pt-6 pb-4 flex flex-col">
                <CurBody onNext={() => goTo(slide + 1)} onClose={closeSession} />
              </div>
            </div>

            {/* Incoming slide (enters) — only rendered during transition */}
            {InHero && InBody && (
              <div className={cn(
                "absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out",
                transActive
                  ? "translate-x-0"
                  : (transDir === "left" ? "translate-x-full" : "-translate-x-full")
              )}>
                <InHero />
                <div className="flex-1 overflow-hidden px-8 pt-6 pb-4 flex flex-col">
                  <InBody onNext={() => goTo(transSlide! + 1)} onClose={closeSession} />
                </div>
              </div>
            )}
          </div>

          {/* Footer dots — update immediately to target slide */}
          <div className="flex-shrink-0 flex items-center justify-center px-8 py-4 border-t border-border">
            <div className="flex items-center gap-2">
              {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    i === activeSlide
                      ? "w-6 h-2 bg-foreground"
                      : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                  )}
                  aria-label={`Go to slide ${i + 1}`}
                  data-testid={`button-onboarding-dot-${i}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={next}
          disabled={activeSlide === TOTAL_SLIDES - 1}
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white transition-all",
            activeSlide === TOTAL_SLIDES - 1 ? "opacity-20 cursor-not-allowed" : "hover:bg-white/25"
          )}
          aria-label="Next slide"
          data-testid="button-onboarding-next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
