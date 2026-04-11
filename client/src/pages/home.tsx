import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ArrowRight, CheckCircle, CheckCircle2, Zap,
  Briefcase, ChefHat, Megaphone, Headphones,
  TrendingUp, Star, RotateCcw, ShoppingBag,
  Truck, Utensils, Users2, Heart, Smartphone,
} from "lucide-react";
import { SiWhatsapp, SiSlack, SiTelegram, SiMessenger, SiDiscord } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useBookCall } from "@/lib/book-call-context";
import { cn } from "@/lib/utils";
import { plans } from "@/data/plans";

// ─── Data ─────────────────────────────────────────────────────────────────────

const heroImages = [
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&q=80",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=1920&q=80",
  "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=1920&q=80",
];

const rotatingWords = ["delivery", "menu", "social", "reputation"];

const liveMetricValues = ["+18%", "3.1×", "4.8★", "24/7"];
const liveMetricKeys = ["home.metric_orders", "home.metric_roas", "home.metric_rating", "home.metric_autonomous"];


// ─── Sections ─────────────────────────────────────────────────────────────────

function HeroSection() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 180]);
  const onBookCall = useBookCall();
  const { t } = useTranslation();

  const [imgIdx, setImgIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setImgIdx(i => (i + 1) % heroImages.length), 4500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setWordIdx(i => (i + 1) % rotatingWords.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden" data-testid="section-hero">

      {/* Crossfading background images */}
      <AnimatePresence mode="sync">
        <motion.div
          key={imgIdx}
          style={{ y }}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
        >
          <img src={heroImages[imgIdx]} alt="Restaurant" className="w-full h-full object-cover" loading="eager" />
        </motion.div>
      </AnimatePresence>

      {/* Gradient overlay — stronger at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/20" />

      {/* Image progress dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
        {heroImages.map((_, i) => (
          <button
            key={i}
            onClick={() => setImgIdx(i)}
            className={cn(
              "rounded-full transition-all duration-300",
              i === imgIdx ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/40"
            )}
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto pt-32 pb-28">

        {/* Live badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/90 text-sm font-medium">{t("home.hero_badge")}</span>
        </motion.div>

        {/* Headline with rotating word */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white font-bold leading-tight"
          data-testid="text-hero-headline"
        >
          {t("home.hero_h1_1")}<br />
          <span className="text-primary">{t("home.hero_h1_2")} </span>
          <span className="inline-block relative">
            <AnimatePresence mode="wait">
              <motion.span
                key={wordIdx}
                className="inline-block text-primary"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                {rotatingWords[wordIdx]}.
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-6 text-lg md:text-xl text-white/75 max-w-xl mx-auto leading-relaxed"
          data-testid="text-hero-subhead"
        >
          {t("home.hero_sub")}
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button size="lg" asChild data-testid="button-hero-start">
            <Link href="/register">
              {t("common.start_free_trial")} <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/30 text-white bg-white/10 backdrop-blur-sm" onClick={onBookCall} data-testid="button-hero-book-call">
            {t("common.book_call")}
          </Button>
        </motion.div>

        {/* Live metrics strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.9 }}
          className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto"
        >
          {liveMetricValues.map((value, i) => (
            <motion.div
              key={liveMetricKeys[i]}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.1, duration: 0.4 }}
              className="flex flex-col items-center gap-0.5 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15"
            >
              <span className="font-serif text-2xl font-bold text-white">{value}</span>
              <span className="text-white/55 text-xs">{t(liveMetricKeys[i])}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function AgentTeamSection() {
  const { t } = useTranslation();

  const agentsT = [
    {
      id: "operation", name: t("home.op_name"), tagline: t("home.op_tagline"),
      icon: Briefcase, color: "bg-blue-600", textColor: "text-blue-700", tagBg: "bg-blue-100",
      img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=700&q=80", imgAlt: "Analytics dashboard",
      tags: [t("home.op_tag1"), t("home.op_tag2"), t("home.op_tag3")],
      capabilities: [t("home.op_cap1"), t("home.op_cap2"), t("home.op_cap3"), t("home.op_cap4"), t("home.op_cap5")],
    },
    {
      id: "chef", name: t("home.chef_name"), tagline: t("home.chef_tagline"),
      icon: ChefHat, color: "bg-amber-500", textColor: "text-amber-700", tagBg: "bg-amber-100",
      img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&q=80", imgAlt: "Restaurant food",
      tags: [t("home.chef_tag1"), t("home.chef_tag2"), t("home.chef_tag3")],
      capabilities: [t("home.chef_cap1"), t("home.chef_cap2"), t("home.chef_cap3"), t("home.chef_cap4"), t("home.chef_cap5")],
    },
    {
      id: "social", name: t("home.social_name"), tagline: t("home.social_tagline"),
      icon: Megaphone, color: "bg-purple-600", textColor: "text-purple-700", tagBg: "bg-purple-100",
      img: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=700&q=80", imgAlt: "Social media on phone",
      tags: [t("home.social_tag1"), t("home.social_tag2"), t("home.social_tag3")],
      capabilities: [t("home.social_cap1"), t("home.social_cap2"), t("home.social_cap3"), t("home.social_cap4"), t("home.social_cap5")],
    },
    {
      id: "customer", name: t("home.cs_name"), tagline: t("home.cs_tagline"),
      icon: Headphones, color: "bg-teal-600", textColor: "text-teal-700", tagBg: "bg-teal-100",
      img: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=700&q=80", imgAlt: "Customer service and reviews",
      tags: [t("home.cs_tag1"), t("home.cs_tag2"), t("home.cs_tag3")],
      capabilities: [t("home.cs_cap1"), t("home.cs_cap2"), t("home.cs_cap3"), t("home.cs_cap4"), t("home.cs_cap5")],
    },
  ];

  return (
    <section className="pt-10 pb-20 md:pt-12 md:pb-28 bg-background" id="agents" data-testid="section-agents">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="max-w-3xl mx-auto text-center mb-16">
          <Badge variant="secondary" className="mb-4">{t("home.agents_badge")}</Badge>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold" data-testid="text-agents-headline">
            {t("home.agents_h2_1")}<br className="hidden sm:block" /> <span className="text-primary">{t("home.agents_h2_2")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            {t("home.agents_desc")}
          </p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agentsT.map((agent, i) => (
            <RevealOnScroll key={agent.id} delay={i * 0.1}>
              <div className="group rounded-2xl border border-border bg-card overflow-hidden hover-elevate h-full flex flex-col" data-testid={`card-agent-${agent.id}`}>
                {/* Image */}
                <div className="aspect-[16/7] overflow-hidden relative flex-shrink-0">
                  <img
                    src={agent.img} alt={agent.imgAlt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2.5">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", agent.color)}>
                      <agent.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold leading-tight">{agent.name}</p>
                      <p className="text-white/70 text-[11px] leading-tight">{agent.tagline}</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  {/* Capability tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {agent.tags.map((tag) => (
                      <span key={tag} className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", agent.tagBg, agent.textColor)}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Capability list */}
                  <ul className="space-y-2 flex-1">
                    {agent.capabilities.map((cap, ci) => (
                      <li key={ci} className="flex items-start gap-2.5">
                        <CheckCircle className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", agent.textColor)} />
                        <span className="text-sm text-foreground/75 leading-snug">{cap}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Learn more link */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <Link
                      href={`/agents/${agent.id}`}
                      className={cn("text-sm font-semibold flex items-center gap-1.5 hover-elevate", agent.textColor)}
                      data-testid={`link-agent-learn-more-${agent.id}`}
                    >
                      {t("common.learn_more")} — {agent.name} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServicesPoweredSection() {
  const { t } = useTranslation();
  const servicesT = [
    {
      icon: Truck,
      name: t("home.svc_delivery_name"),
      desc: t("home.svc_delivery_desc"),
      img: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&q=80",
      imgAlt: "Food ready for delivery",
      agentId: "operation",
      agentName: t("home.op_name"),
      agentColor: "bg-blue-600",
      agentText: "text-blue-700",
      agentBg: "bg-blue-50",
    },
    {
      icon: Utensils,
      name: t("home.svc_menu_name"),
      desc: t("home.svc_menu_desc"),
      img: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=700&q=80",
      imgAlt: "Restaurant food photography",
      agentId: "chef",
      agentName: t("home.chef_name"),
      agentColor: "bg-amber-500",
      agentText: "text-amber-700",
      agentBg: "bg-amber-50",
    },
    {
      icon: Megaphone,
      name: t("home.svc_social_name"),
      desc: t("home.svc_social_desc"),
      img: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=700&q=80",
      imgAlt: "Social media content creation",
      agentId: "social",
      agentName: t("home.social_name"),
      agentColor: "bg-purple-600",
      agentText: "text-purple-700",
      agentBg: "bg-purple-50",
    },
    {
      icon: Users2,
      name: t("home.svc_influencer_name"),
      desc: t("home.svc_influencer_desc"),
      img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&q=80",
      imgAlt: "Food content for influencer collaboration",
      agentId: "social",
      agentName: t("home.social_name"),
      agentColor: "bg-purple-600",
      agentText: "text-purple-700",
      agentBg: "bg-purple-50",
    },
    {
      icon: Star,
      name: t("home.svc_reviews_name"),
      desc: t("home.svc_reviews_desc"),
      img: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=700&q=80",
      imgAlt: "Restaurant dining experience",
      agentId: "customer",
      agentName: t("home.cs_name"),
      agentColor: "bg-teal-600",
      agentText: "text-teal-700",
      agentBg: "bg-teal-50",
    },
    {
      icon: Heart,
      name: t("home.svc_loyalty_name"),
      desc: t("home.svc_loyalty_desc"),
      img: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&q=80",
      imgAlt: "Warm restaurant atmosphere for loyal guests",
      agentId: "customer",
      agentName: t("home.cs_name"),
      agentColor: "bg-teal-600",
      agentText: "text-teal-700",
      agentBg: "bg-teal-50",
    },
  ];
  return (
    <section className="py-20 md:py-28 bg-card" data-testid="section-services">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="max-w-3xl mx-auto text-center mb-16">
          <Badge variant="secondary" className="mb-4">{t("home.services_badge")}</Badge>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold" data-testid="text-services-headline">
            {t("home.services_h2_1")}<br />
            <span className="text-primary">{t("home.services_h2_2")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            {t("home.services_desc2")}
          </p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {servicesT.map((svc, i) => (
            <RevealOnScroll key={svc.name} delay={i * 0.07}>
              <div className="rounded-2xl border border-border bg-background h-full flex flex-col hover-elevate overflow-hidden" data-testid={`card-service-${i}`}>
                {/* Image header */}
                <div className="aspect-[16/7] overflow-hidden flex-shrink-0 relative">
                  <img
                    src={svc.img}
                    alt={svc.imgAlt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className={cn("absolute bottom-3 left-3 w-7 h-7 rounded-lg flex items-center justify-center", svc.agentBg)}>
                    <svc.icon className={cn("w-3.5 h-3.5", svc.agentText)} />
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-serif text-base font-semibold text-foreground mb-2">{svc.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{svc.desc}</p>

                  {/* Agent attribution */}
                  <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0", svc.agentColor)}>
                      {svc.agentId === "operation" && <Briefcase className="w-3 h-3 text-white" />}
                      {svc.agentId === "chef" && <ChefHat className="w-3 h-3 text-white" />}
                      {svc.agentId === "social" && <Megaphone className="w-3 h-3 text-white" />}
                      {svc.agentId === "customer" && <Headphones className="w-3 h-3 text-white" />}
                    </div>
                    <span className={cn("text-[11px] font-semibold", svc.agentText)}>{t("home.handled_by")} {svc.agentName}</span>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll className="mt-10 text-center">
          <Button asChild data-testid="button-services-cta">
            <Link href="/register">
              {t("common.start_free_trial")} <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </RevealOnScroll>
      </div>
    </section>
  );
}

function BoardroomSection() {
  const { t } = useTranslation();
  const boardroomMessagesT = [
    {
      agentId: "operation", label: t("home.op_name"), bg: "bg-blue-600", icon: Briefcase,
      text: t("home.boardroom_op"),
    },
    {
      agentId: "chef", label: t("home.chef_name"), bg: "bg-amber-500", icon: ChefHat,
      text: t("home.boardroom_chef"),
    },
    {
      agentId: "social", label: t("home.social_name"), bg: "bg-purple-600", icon: Megaphone,
      text: t("home.boardroom_social"),
    },
    {
      agentId: "customer", label: t("home.cs_name"), bg: "bg-teal-600", icon: Headphones,
      text: t("home.boardroom_cs"),
    },
  ];
  const boardroomFeatures = [
    [t("home.boardroom_feat1_title"), t("home.boardroom_feat1_desc")],
    [t("home.boardroom_feat2_title"), t("home.boardroom_feat2_desc")],
    [t("home.boardroom_feat3_title"), t("home.boardroom_feat3_desc")],
    [t("home.boardroom_feat4_title"), t("home.boardroom_feat4_desc")],
  ];
  return (
    <section className="py-20 md:py-28 bg-[#2A2A2A]" data-testid="section-boardroom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          <RevealOnScroll>
            <Badge className="mb-5 bg-white/10 text-white border-white/20">{t("home.boardroom_badge")}</Badge>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-6" data-testid="text-boardroom-headline">
              {t("home.boardroom_h2_1")}<br />
              <span className="text-primary">{t("home.boardroom_h2_2")}</span>
            </h2>
            <p className="text-white/65 text-lg leading-relaxed mb-8">
              {t("home.boardroom_desc2")}
            </p>

            <div className="space-y-4 mb-8">
              {boardroomFeatures.map(([title, desc]) => (
                <div key={title as string} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{title as string}</p>
                    <p className="text-white/55 text-sm mt-0.5">{desc as string}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button size="lg" asChild data-testid="button-boardroom-start">
              <Link href="/register">
                {t("home.boardroom_cta")} <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </RevealOnScroll>

          {/* Boardroom mockup */}
          <RevealOnScroll delay={0.15}>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-white/50 text-xs font-medium">{t("home.boardroom_window_title")}</span>
                </div>
                <div className="flex items-center gap-1">
                  {boardroomMessagesT.map((m) => (
                    <div key={m.agentId} className={cn("w-4 h-4 rounded-full flex items-center justify-center", m.bg)}>
                      <m.icon className="w-2.5 h-2.5 text-white" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {boardroomMessagesT.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="flex gap-3"
                  >
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", msg.bg)}>
                      <msg.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/55 text-[10px] font-semibold mb-1 uppercase tracking-wide">{msg.label}</p>
                      <div className="bg-white/8 border border-white/10 rounded-xl px-3.5 py-2.5">
                        <p className="text-white/80 text-xs leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <div className="flex items-center gap-2 pt-2">
                  <div className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5">
                    <p className="text-white/30 text-xs">{t("home.boardroom_input_placeholder")}</p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

function AiVsOwnerSection() {
  const { t } = useTranslation();
  const aiHandlesT = [
    { icon: Truck, label: t("home.ai_delivery_bidding") },
    { icon: TrendingUp, label: t("home.ai_budget") },
    { icon: Utensils, label: t("home.ai_menu_audits") },
    { icon: ChefHat, label: t("home.ai_dish_research") },
    { icon: Megaphone, label: t("home.ai_content") },
    { icon: Star, label: t("home.ai_reviews") },
    { icon: Users2, label: t("home.ai_creator") },
    { icon: RotateCcw, label: t("home.ai_winback") },
    { icon: ShoppingBag, label: t("home.ai_upsell") },
    { icon: Zap, label: t("home.ai_reporting") },
  ];
  const ownerControlsT = [
    { icon: CheckCircle2, label: t("home.ctrl_approve") },
    { icon: Briefcase, label: t("home.ctrl_goals") },
    { icon: Megaphone, label: t("home.ctrl_content") },
    { icon: ChefHat, label: t("home.ctrl_dishes") },
    { icon: Users2, label: t("home.ctrl_creators") },
    { icon: Star, label: t("home.ctrl_promos") },
    { icon: TrendingUp, label: t("home.ctrl_activity") },
    { icon: Zap, label: t("home.ctrl_boardroom") },
  ];
  return (
    <section className="py-16 md:py-24 bg-card" data-testid="section-control">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="max-w-3xl mx-auto text-center mb-12">
          <Badge variant="secondary" className="mb-4">{t("home.control_badge")}</Badge>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold" data-testid="text-control-headline">
            {t("home.control_h2_1")}<br />
            <span className="text-primary">{t("home.control_h2_2")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            {t("home.control_desc")}
          </p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* AI column */}
          <RevealOnScroll>
            <div className="rounded-2xl border border-border bg-[#2A2A2A] p-6 h-full">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{t("home.ai_handles_title")}</p>
                  <p className="text-white/50 text-[11px]">{t("home.ai_handles_subtitle")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {aiHandlesT.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-lg px-3 py-2.5">
                    <item.icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-white/75 text-xs font-medium leading-snug">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* Owner column */}
          <RevealOnScroll delay={0.1}>
            <div className="rounded-2xl border border-border bg-background p-6 h-full">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold">{t("home.owner_controls_title")}</p>
                  <p className="text-muted-foreground text-[11px]">{t("home.owner_controls_subtitle")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ownerControlsT.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2.5">
                    <item.icon className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                    <span className="text-foreground/75 text-xs font-medium leading-snug">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

function OutcomesSection() {
  const { t } = useTranslation();
  const outcomesT = [
    { icon: TrendingUp, metric: "+18%", label: t("home.out_orders_label"), desc: t("home.out_orders_desc") },
    { icon: ShoppingBag, metric: "+22%", label: t("home.out_aov_label"), desc: t("home.out_aov_desc") },
    { icon: Star, metric: "+0.3★", label: t("home.out_rating_label"), desc: t("home.out_rating_desc") },
    { icon: RotateCcw, metric: "+14%", label: t("home.out_repeat_label"), desc: t("home.out_repeat_desc") },
    { icon: CheckCircle2, metric: "3.1x", label: t("home.out_roas_label"), desc: t("home.out_roas_desc") },
    { icon: Zap, metric: "24/7", label: t("home.out_autonomous_label"), desc: t("home.out_autonomous_desc") },
  ];
  const outcomeImages = [
    { src: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=72", alt: "Restaurant interior", caption: t("home.outcome_img1_caption") },
    { src: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=72", alt: "Food photography", caption: t("home.outcome_img2_caption") },
    { src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=72", alt: "Analytics", caption: t("home.outcome_img3_caption") },
  ];
  return (
    <section className="pt-6 pb-16 md:pt-8 md:pb-20 bg-background" data-testid="section-outcomes">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="max-w-3xl mx-auto text-center mb-10">
          <Badge variant="secondary" className="mb-4">{t("home.outcomes_badge")}</Badge>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold" data-testid="text-outcomes-headline">
            {t("home.outcomes_h2_1")}<br /><span className="text-primary">{t("home.outcomes_h2_2")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            {t("home.outcomes_desc2")}
          </p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          {outcomeImages.map((img, i) => (
            <RevealOnScroll key={i} delay={i * 0.1}>
              <div className="overflow-hidden rounded-xl group">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={img.src} alt={img.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <p className="mt-3 text-center text-sm text-muted-foreground font-medium">{img.caption}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {outcomesT.map((o, i) => (
            <RevealOnScroll key={i} delay={i * 0.08}>
              <div className="p-6 rounded-xl bg-card border border-border text-center" data-testid={`card-outcome-${i}`}>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <o.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-serif text-3xl font-bold text-foreground mb-1">{o.metric}</p>
                <p className="text-sm font-semibold text-foreground mb-1">{o.label}</p>
                <p className="text-xs text-muted-foreground">{o.desc}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing Section ──────────────────────────────────────────────────────────

function AgentDots({ count }: { count: number }) {
  const agentColors = [
    "bg-blue-600",
    "bg-amber-500",
    "bg-purple-600",
    "bg-teal-600",
  ];
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center",
            i < count ? agentColors[i] : "bg-border"
          )}
        >
          {i < count && <Zap className="w-2.5 h-2.5 text-white" />}
        </div>
      ))}
    </div>
  );
}

function PricingSection() {
  const { t } = useTranslation();
  return (
    <section className="py-20 md:py-28 bg-background" id="pricing" data-testid="section-pricing">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <RevealOnScroll>
          <div className="text-center mb-4">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">{t("home.pricing_badge")}</Badge>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {t("home.pricing_h2")}
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {t("home.pricing_desc")}
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.05}>
          <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto mb-12">
            {t("home.pricing_desc2")}
          </p>
        </RevealOnScroll>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {plans.map((plan, i) => (
            <RevealOnScroll key={plan.id} delay={i * 0.08} className="h-full">
              <div className={cn(
                "relative rounded-2xl border-2 bg-card flex flex-col h-full overflow-hidden transition-shadow hover:shadow-md",
                plan.popular ? "border-primary shadow-sm" : "border-border"
              )}>
                {/* Popular banner */}
                {plan.popular ? (
                  <div className="bg-primary text-primary-foreground text-xs font-semibold text-center py-1.5 tracking-wide">
                    Most Popular
                  </div>
                ) : (
                  <div className="py-1.5" />
                )}

                <div className="px-6 pt-5 pb-6 flex flex-col flex-1">

                  {/* Agent dots */}
                  <AgentDots count={plan.agentCount} />

                  {/* Count + price row */}
                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <span className="font-serif text-5xl font-bold text-foreground leading-none">
                        {plan.agentCount}
                      </span>
                      <span className="block text-xs font-semibold text-muted-foreground mt-0.5 uppercase tracking-wider">
                        {plan.agentCount === 1 ? t("home.pricing_agent_singular") : t("home.pricing_agent_plural")}
                      </span>
                    </div>
                    <div className="text-right pb-0.5">
                      <div className="flex items-baseline gap-0.5 justify-end">
                        <span className="font-serif text-2xl font-bold text-foreground">{plan.price}</span>
                        <span className="text-xs text-muted-foreground">/mo</span>
                      </div>
                      <span className="text-xs font-medium text-primary">{plan.tagline}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border my-4" />

                  {/* Best combo */}
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{t("home.pricing_best_combo")}</p>
                    <p className="text-sm text-foreground/70 italic leading-snug">"{plan.comboLabel}"</p>
                  </div>

                  {/* Agent chips */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {plan.includes.map((agent) => (
                      <span
                        key={agent.name}
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white",
                          agent.color
                        )}
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {agent.name}
                      </span>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border mb-4" />

                  {/* Bullets */}
                  <ul className="space-y-2 flex-1">
                    {plan.bullets.map((b, bi) => (
                      <li key={bi} className="flex items-start gap-2 text-sm text-foreground/75">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-5">
                    <Link href="/register">
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        data-testid={`button-pricing-${plan.id}`}
                      >
                        {t("home.pricing_choose_setup")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        {/* Footer note */}
        <RevealOnScroll delay={0.2}>
          <p className="text-center text-sm text-muted-foreground mt-10">
            {t("home.pricing_footer_note")}
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}

function IMChatSection() {
  const { t } = useTranslation();
  const whatsappMessages = [
    { from: "agent", name: t("home.op_name"), color: "bg-blue-600", icon: Briefcase, text: t("home.im_msg1") },
    { from: "user", text: t("home.im_user1") },
    { from: "agent", name: t("home.op_name"), color: "bg-blue-600", icon: Briefcase, text: t("home.im_msg2") },
    { from: "agent", name: t("home.chef_name"), color: "bg-amber-500", icon: ChefHat, text: t("home.im_msg3") },
    { from: "user", text: t("home.im_user2") },
  ];

  return (
    <section className="py-20 md:py-28 bg-background" data-testid="section-im-chat">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — copy */}
          <RevealOnScroll direction="left">
            <Badge variant="secondary" className="mb-4">{t("home.channels_badge")}</Badge>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight mb-5" data-testid="text-im-headline">
              {t("home.im_h2_1")}<br />
              <span className="text-primary">{t("home.im_h2_2")}</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">{t("home.im_desc")}</p>
            <ul className="space-y-4 mb-8">
              {[
                { icon: Smartphone, text: t("home.im_bullet1") },
                { icon: CheckCircle2, text: t("home.im_bullet2") },
                { icon: Zap, text: t("home.im_bullet3") },
                { icon: TrendingUp, text: t("home.im_bullet4") },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <item.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-foreground/80 text-sm leading-snug">{item.text}</span>
                </li>
              ))}
            </ul>

            {/* Platform logos */}
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-3">{t("home.im_works_with")}</p>
              <div className="flex flex-nowrap gap-2">
                {[
                  { icon: SiWhatsapp, label: "WhatsApp", color: "#25D366" },
                  { icon: SiMessenger, label: "Messenger", color: "#0099FF" },
                  { icon: SiTelegram, label: "Telegram", color: "#26A5E4" },
                  { icon: SiSlack, label: "Slack", color: "#4A154B" },
                  { icon: SiDiscord, label: "Discord", color: "#5865F2" },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-sm font-medium text-foreground">
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* Right — WhatsApp mockup */}
          <RevealOnScroll direction="right" delay={0.1}>
            <div className="rounded-3xl overflow-hidden shadow-xl border border-border max-w-sm mx-auto">
              {/* Phone header */}
              <div className="bg-[#25D366] px-4 pt-4 pb-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight">{t("home.im_phone_title")}</p>
                  <p className="text-white/70 text-[11px]">{t("home.im_phone_subtitle")}</p>
                </div>
                <SiWhatsapp className="w-5 h-5 text-white/60" />
              </div>

              {/* Chat messages */}
              <div className="bg-[#ECE5DD] px-3 py-4 space-y-3 min-h-[340px]">
                {whatsappMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.18, duration: 0.3 }}
                    className={cn("flex", msg.from === "user" ? "justify-end" : "justify-start")}
                  >
                    {msg.from === "agent" && (
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1 self-start", msg.color)}>
                        {msg.icon && <msg.icon className="w-3 h-3 text-white" />}
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[78%] rounded-xl px-3 py-2 shadow-sm",
                      msg.from === "user"
                        ? "bg-[#DCF8C6] rounded-tr-none"
                        : "bg-white rounded-tl-none"
                    )}>
                      {msg.from === "agent" && (
                        <p className={cn("text-[10px] font-semibold mb-0.5", msg.color?.replace("bg-", "text-"))}>{msg.name}</p>
                      )}
                      <p className="text-[12px] text-gray-800 leading-relaxed">{msg.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Input bar */}
              <div className="bg-[#F0F0F0] px-3 py-2.5 flex items-center gap-2 border-t border-gray-200">
                <div className="flex-1 bg-white rounded-full px-4 py-2">
                  <p className="text-gray-400 text-xs">{t("home.im_input_placeholder")}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </RevealOnScroll>

        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const { t } = useTranslation();
  const onBookCall = useBookCall();
  const ctaServiceNames = [
    t("home.svc_delivery_name"),
    t("home.svc_menu_name"),
    t("home.svc_social_name"),
    t("home.svc_influencer_name"),
    t("home.svc_reviews_name"),
    t("home.svc_loyalty_name"),
  ];
  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-primary" data-testid="section-cta">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <RevealOnScroll>
          <Badge className="mb-5 bg-white/20 text-white border-white/30">{t("home.cta_badge")}</Badge>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white" data-testid="text-cta-headline">
            {t("home.cta_h2_1")}<br />{t("home.cta_h2_2")}
          </h2>
          <p className="mt-5 text-white/80 text-lg max-w-2xl mx-auto leading-relaxed" data-testid="text-cta-subhead">
            {t("home.cta_desc")}
          </p>

          {/* Service tags */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {ctaServiceNames.map((name) => (
              <span key={name} className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-white/15 text-white border border-white/20">{name}</span>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-primary border-white hover:bg-white/90" asChild data-testid="button-cta-start">
              <Link href="/register">
                {t("common.start_free_trial")} <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/25" onClick={onBookCall} data-testid="button-cta-book-call">
              {t("home.cta_book_call")}
            </Button>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroSection />
        <AgentTeamSection />
        <OutcomesSection />
        <ServicesPoweredSection />
        <BoardroomSection />
        <IMChatSection />
        <AiVsOwnerSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
