import { ArrowRight, Briefcase, ChefHat, Megaphone, Headphones, Zap, CheckCircle, ShieldCheck, RefreshCcw, MessageSquare, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Link } from "wouter";
import { plans } from "@/data/plans";
import { useTranslation } from "react-i18next";

const agentIcons = [Briefcase, ChefHat, Megaphone, Headphones];

function AgentDots({ count }: { count: number }) {
  const agentColors = ["bg-blue-600", "bg-amber-500", "bg-purple-600", "bg-teal-600"];
  return (
    <div className="flex gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center",
            i < count ? agentColors[i] : "bg-border"
          )}
        >
          {i < count && <Zap className="w-3.5 h-3.5 text-white" />}
        </div>
      ))}
    </div>
  );
}

export default function Pricing() {
  const { t } = useTranslation();

  const universalInclusions = [
    { icon: ShieldCheck, title: t("pricing.trial_title"), desc: t("pricing.trial_desc") },
    { icon: RefreshCcw,  title: t("pricing.contracts_title"), desc: t("pricing.contracts_desc") },
    { icon: MessageSquare, title: t("pricing.access_title"), desc: t("pricing.access_desc") },
    { icon: BarChart3,   title: t("pricing.reports_title"), desc: t("pricing.reports_desc") },
  ];

  const guideRows = [
    {
      labelKey: "pricing.guide_best_for",
      values: [
        t("pricing.guide_solo"),
        t("pricing.guide_small"),
        t("pricing.guide_growing"),
        t("pricing.guide_multi"),
      ],
    },
    {
      labelKey: "pricing.guide_agents",
      values: [
        `1 ${t("common.agent")}`,
        `2 ${t("common.agents")}`,
        `3 ${t("common.agents")}`,
        `4 ${t("common.agents")}`,
      ],
    },
    {
      labelKey: "pricing.guide_channels",
      values: [
        t("pricing.guide_ch1"),
        t("pricing.guide_ch2"),
        t("pricing.guide_ch3"),
        t("pricing.guide_ch4"),
      ],
    },
    {
      labelKey: "pricing.guide_price",
      values: ["$199/mo", "$299/mo", "$399/mo", "$459/mo"],
    },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <main>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="pt-32 pb-0 bg-card border-b border-border overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">

              {/* Left — copy */}
              <div className="pb-16">
                <Badge variant="secondary" className="mb-4">{t("pricing.badge")}</Badge>
                <h1
                  className="font-serif text-4xl sm:text-5xl font-bold text-foreground leading-tight"
                  data-testid="text-pricing-headline"
                >
                  {t("pricing.headline")}{" "}
                  <span className="text-primary">{t("pricing.headline2")}</span>
                </h1>
                <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
                  {t("pricing.sub1")}
                </p>
                <p className="mt-3 text-muted-foreground text-lg leading-relaxed">
                  {t("pricing.sub2")}
                </p>

                {/* Quick-glance price list */}
                <div className="mt-8 flex flex-wrap gap-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium",
                        plan.popular
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-foreground"
                      )}
                    >
                      <span className="font-serif font-bold">{plan.agentCount}</span>
                      <span className="text-xs opacity-70">{plan.agentCount === 1 ? t("common.agent") : t("common.agents")}</span>
                      <span className="font-bold">{plan.price}</span>
                      <span className="text-xs opacity-60">{t("common.month")}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — image */}
              <div className="relative h-72 lg:h-auto lg:self-stretch min-h-[360px]">
                <img
                  src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80"
                  alt="Restaurant dining — AI-powered growth with Favie"
                  className="absolute inset-0 w-full h-full object-cover rounded-tl-2xl"
                  loading="eager"
                  data-testid="img-pricing-hero"
                />
                {/* Gradient fade to left */}
                <div className="absolute inset-0 bg-gradient-to-r from-card via-card/20 to-transparent rounded-tl-2xl pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing cards ─────────────────────────────────────────────────── */}
        <section className="py-20 bg-background" data-testid="section-pricing-cards">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

            <RevealOnScroll>
              <p className="text-sm text-muted-foreground mb-10">
                Different businesses need different levels of support. Hire the number of AI agents that fits your workflow, and expand anytime.
              </p>
            </RevealOnScroll>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
              {plans.map((plan, i) => {
                const Icon = agentIcons[plan.agentCount - 1];
                return (
                  <RevealOnScroll key={plan.id} delay={i * 0.08} className="h-full">
                    <div className={cn(
                      "relative rounded-2xl border-2 bg-card flex flex-col h-full overflow-hidden",
                      plan.popular ? "border-primary shadow-md" : "border-border"
                    )}>
                      {plan.popular ? (
                        <div className="bg-primary text-primary-foreground text-sm font-semibold text-center py-2 tracking-wide">
                          {t("common.popular")}
                        </div>
                      ) : (
                        <div className="py-2" />
                      )}

                      <div className="px-7 pt-6 pb-7 flex flex-col flex-1">

                        {/* Agent dots */}
                        <AgentDots count={plan.agentCount} />

                        {/* Count + price */}
                        <div className="mt-5 flex items-end justify-between gap-2">
                          <div>
                            <span className="font-serif text-6xl font-bold text-foreground leading-none">
                              {plan.agentCount}
                            </span>
                            <span className="block text-sm font-semibold text-muted-foreground mt-1 uppercase tracking-wider">
                              {plan.agentCount === 1 ? t("common.agent") : t("common.agents")}
                            </span>
                          </div>
                          <div className="text-right pb-1">
                            <div className="flex items-baseline gap-1 justify-end">
                              <span className="font-serif text-3xl font-bold text-foreground">{plan.price}</span>
                              <span className="text-sm text-muted-foreground">{t("common.month")}</span>
                            </div>
                            <span className="text-sm font-medium text-primary">{plan.tagline}</span>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-border my-5" />

                        {/* Best combo */}
                        <div className="mb-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{t("pricing.best_combo")}</p>
                          <p className="text-sm text-foreground/70 italic leading-relaxed">"{plan.comboLabel}"</p>
                        </div>

                        {/* Agent chips */}
                        <div className="flex flex-wrap gap-2 mb-5">
                          {plan.includes.map((agent) => (
                            <span
                              key={agent.name}
                              className={cn(
                                "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full text-white",
                                agent.color
                              )}
                            >
                              <Zap className="w-3 h-3" />
                              {agent.name}
                            </span>
                          ))}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-border mb-5" />

                        {/* Bullets */}
                        <ul className="space-y-3 flex-1">
                          {plan.bullets.map((b, bi) => (
                            <li key={bi} className="flex items-start gap-2.5 text-sm text-foreground/80">
                              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>

                        {/* CTA */}
                        <div className="mt-6">
                          <Link href="/register">
                            <Button
                              className="w-full"
                              variant={plan.popular ? "default" : "outline"}
                              data-testid={`button-pricing-page-${plan.id}`}
                            >
                              {t("pricing.choose_setup")} <ArrowRight className="w-4 h-4 ml-1.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </RevealOnScroll>
                );
              })}
            </div>

            <RevealOnScroll delay={0.2}>
              <p className="text-center text-sm text-muted-foreground mt-10">
                {t("pricing.all_plans_note")}
              </p>
            </RevealOnScroll>
          </div>
        </section>

        {/* ── Included in every plan ────────────────────────────────────────── */}
        <section className="py-16 bg-card border-y border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">{t("pricing.inclusions_badge")}</Badge>
              <h2 className="font-serif text-3xl font-bold text-foreground">
                {t("pricing.inclusions_h2")}
              </h2>
            </RevealOnScroll>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {universalInclusions.map((item, i) => (
                <RevealOnScroll key={item.title} delay={i * 0.08}>
                  <div className="bg-background rounded-xl border border-border p-6 h-full">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── Which plan is right for you? ──────────────────────────────────── */}
        <section className="py-16 bg-background">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10">
              <Badge variant="secondary" className="mb-4">{t("pricing.guide_badge")}</Badge>
              <h2 className="font-serif text-3xl font-bold text-foreground mb-3">
                {t("pricing.guide_h2")}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl">
                {t("pricing.guide_sub")}
              </p>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1}>
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm" data-testid="table-plan-guide">
                  <thead>
                    <tr className="bg-card border-b border-border">
                      <th className="text-left px-6 py-4 font-semibold text-muted-foreground w-36"></th>
                      {plans.map((plan) => (
                        <th key={plan.id} className={cn(
                          "px-5 py-4 text-center font-bold text-foreground",
                          plan.popular && "bg-primary/5"
                        )}>
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-serif text-2xl">{plan.agentCount}</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {plan.agentCount === 1 ? t("common.agent") : t("common.agents")}
                            </span>
                            {plan.popular && (
                              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{t("common.popular")}</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guideRows.map((row, ri) => (
                      <tr key={row.labelKey} className={cn("border-b border-border last:border-0", ri % 2 === 0 ? "bg-background" : "bg-card")}>
                        <td className="px-6 py-4 font-semibold text-foreground/70 text-xs uppercase tracking-wider">
                          {t(row.labelKey)}
                        </td>
                        {row.values.map((val, vi) => (
                          <td key={vi} className={cn(
                            "px-5 py-4 text-center text-sm text-foreground",
                            plans[vi]?.popular && "bg-primary/5"
                          )}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="py-20 bg-primary">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <RevealOnScroll>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-4">
                {t("pricing.cta_h2")}
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                {t("pricing.cta_sub")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-white text-primary font-semibold px-8"
                    data-testid="button-pricing-cta-register"
                  >
                    {t("pricing.cta_trial")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/about">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white text-white bg-transparent"
                    data-testid="button-pricing-cta-learn"
                  >
                    {t("pricing.cta_learn")}
                  </Button>
                </Link>
              </div>
            </RevealOnScroll>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
