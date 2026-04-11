import { ArrowRight, BarChart3, TrendingUp, ShoppingBag, Star, RotateCcw, Globe, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useBookCall } from "@/lib/book-call-context";
import { useTranslation } from "react-i18next";

export default function Results() {
  const onBookCall = useBookCall();
  const { t } = useTranslation();

  const kpis = [
    { metric: "+18%", label: t("results_page.kpi_order_label"), sub: t("results_page.kpi_order_sub") },
    { metric: "3.1x", label: t("results_page.kpi_roas_label"), sub: t("results_page.kpi_roas_sub") },
    { metric: "+31%", label: t("results_page.kpi_ctr_label"), sub: t("results_page.kpi_ctr_sub") },
    { metric: "+3.8x", label: t("results_page.kpi_reach_label"), sub: t("results_page.kpi_reach_sub") },
    { metric: "+0.3★", label: t("results_page.kpi_rating_label"), sub: t("results_page.kpi_rating_sub") },
    { metric: "+14%", label: t("results_page.kpi_repeat_label"), sub: t("results_page.kpi_repeat_sub") },
  ];

  const metricCategories = [
    {
      icon: BarChart3,
      title: t("results_page.metric_delivery_title"),
      desc: t("results_page.metric_delivery_desc"),
      tags: [t("results_page.tag_ad_roas"), t("results_page.tag_ctr"), t("results_page.tag_order_volume"), t("results_page.tag_conversion_rate")],
    },
    {
      icon: ShoppingBag,
      title: t("results_page.metric_revenue_title"),
      desc: t("results_page.metric_revenue_desc"),
      tags: [t("results_page.tag_aov"), t("results_page.tag_bundle_rate"), t("results_page.tag_margin_mix"), t("results_page.tag_basket_size")],
    },
    {
      icon: Globe,
      title: t("results_page.metric_social_title"),
      desc: t("results_page.metric_social_desc"),
      tags: [t("results_page.tag_reach_growth"), t("results_page.tag_engagement_rate"), t("results_page.tag_follower_quality"), t("results_page.tag_content_roi")],
    },
    {
      icon: Star,
      title: t("results_page.metric_reputation_title"),
      desc: t("results_page.metric_reputation_desc"),
      tags: [t("results_page.tag_star_rating"), t("results_page.tag_review_volume"), t("results_page.tag_response_rate"), t("results_page.tag_sentiment")],
    },
    {
      icon: TrendingUp,
      title: t("results_page.metric_creator_title"),
      desc: t("results_page.metric_creator_desc"),
      tags: [t("results_page.tag_earned_reach"), t("results_page.tag_campaign_roi"), t("results_page.tag_engagement_pct"), t("results_page.tag_cost_per_reach")],
    },
    {
      icon: RotateCcw,
      title: t("results_page.metric_retention_title"),
      desc: t("results_page.metric_retention_desc"),
      tags: [t("results_page.tag_repeat_rate"), t("results_page.tag_ltv_trend"), t("results_page.tag_winback_roi"), t("results_page.tag_crm_roi")],
    },
  ];

  const methodology = [
    {
      step: "01",
      title: t("results_page.method_audit_title"),
      desc: t("results_page.method_audit_desc"),
    },
    {
      step: "02",
      title: t("results_page.method_kpis_title"),
      desc: t("results_page.method_kpis_desc"),
    },
    {
      step: "03",
      title: t("results_page.method_reporting_title"),
      desc: t("results_page.method_reporting_desc"),
    },
    {
      step: "04",
      title: t("results_page.method_optimization_title"),
      desc: t("results_page.method_optimization_desc"),
    },
  ];

  const timelineCards = [
    {
      period: t("results_page.timeline_30_period"),
      color: "border-blue-200 bg-blue-50",
      textColor: "text-blue-700",
      items: [
        t("results_page.timeline_30_item1"),
        t("results_page.timeline_30_item2"),
        t("results_page.timeline_30_item3"),
        t("results_page.timeline_30_item4"),
      ],
      img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80",
      imgAlt: "Business setup and analytics",
    },
    {
      period: t("results_page.timeline_60_period"),
      color: "border-amber-200 bg-amber-50",
      textColor: "text-amber-700",
      items: [
        t("results_page.timeline_60_item1"),
        t("results_page.timeline_60_item2"),
        t("results_page.timeline_60_item3"),
        t("results_page.timeline_60_item4"),
      ],
      img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
      imgAlt: "Restaurant food and growth",
    },
    {
      period: t("results_page.timeline_90_period"),
      color: "border-teal-200 bg-teal-50",
      textColor: "text-teal-700",
      items: [
        t("results_page.timeline_90_item1"),
        t("results_page.timeline_90_item2"),
        t("results_page.timeline_90_item3"),
        t("results_page.timeline_90_item4"),
      ],
      img: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
      imgAlt: "Restaurant results and growth",
    },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <main>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="pt-32 pb-16 bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="secondary" className="mb-4">{t("results_page.badge")}</Badge>
                <h1
                  className="font-serif text-4xl sm:text-5xl font-bold text-foreground leading-tight"
                  data-testid="text-results-headline"
                >
                  {t("results_page.headline_1")} <span className="text-primary">{t("results_page.headline_highlight")}</span><br className="hidden sm:block" /> {t("results_page.headline_2")}
                </h1>
                <p className="mt-4 text-muted-foreground text-lg leading-relaxed max-w-lg">
                  {t("results_page.hero_sub")}
                </p>
                <div className="mt-8">
                  <Button onClick={onBookCall} data-testid="button-results-consult">
                    {t("results_page.book_consultation")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="rounded-2xl overflow-hidden shadow-lg aspect-[4/3]">
                  <img
                    src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&q=72"
                    alt="Restaurant in operation"
                    className="w-full h-full object-cover"
                    loading="eager"
                    data-testid="img-results-hero"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── KPI stat strip ───────────────────────────────────────────────── */}
        <section className="py-12 bg-background border-b border-border" data-testid="section-kpis">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-8 text-center">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">{t("results_page.kpi_section_label")}</p>
            </RevealOnScroll>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {kpis.map((kpi, i) => (
                <RevealOnScroll key={i} delay={i * 0.06}>
                  <div
                    className="rounded-2xl border border-border bg-card p-5 text-center hover-elevate"
                    data-testid={`card-kpi-${i}`}
                  >
                    <p className="font-serif text-3xl font-bold text-primary">{kpi.metric}</p>
                    <p className="font-semibold text-foreground text-xs mt-1 leading-tight">{kpi.label}</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">{kpi.sub}</p>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── What We Track ────────────────────────────────────────────────── */}
        <section className="py-16 bg-background" data-testid="section-metrics">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">{t("results_page.metrics_label")}</p>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold" data-testid="text-results-metrics-headline">
                {t("results_page.metrics_heading_1")}<br />
                <span className="text-primary">{t("results_page.metrics_heading_2")}</span>
              </h2>
            </RevealOnScroll>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {metricCategories.map((cat, i) => (
                <RevealOnScroll key={i} delay={i * 0.07}>
                  <div
                    className="rounded-2xl border border-border bg-card p-6 h-full flex flex-col hover-elevate"
                    data-testid={`card-metric-${i}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 flex-shrink-0">
                      <cat.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground text-base mb-2">{cat.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed flex-1">{cat.desc}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {cat.tags.map((tag) => (
                        <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/8 text-primary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── Methodology ──────────────────────────────────────────────────── */}
        <section className="py-16 bg-card border-y border-border" data-testid="section-methodology">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Image */}
              <RevealOnScroll>
                <div className="rounded-2xl overflow-hidden aspect-[4/3] shadow-sm">
                  <img
                    src="https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=900&q=72"
                    alt="Restaurant food and performance"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </RevealOnScroll>

              {/* Steps */}
              <RevealOnScroll delay={0.1}>
                <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">{t("results_page.method_label")}</p>
                <h2
                  className="font-serif text-2xl sm:text-3xl font-bold mb-6"
                  data-testid="text-results-methodology"
                >
                  {t("results_page.method_heading_1")}<br />
                  <span className="text-primary">{t("results_page.method_heading_2")}</span>
                </h2>
                <div className="space-y-4">
                  {methodology.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-4 p-4 rounded-xl bg-background border border-border"
                      data-testid={`step-methodology-${i}`}
                    >
                      <span className="font-serif text-2xl font-bold text-primary/30 flex-shrink-0 w-10 text-center leading-none pt-0.5">
                        {step.step}
                      </span>
                      <div>
                        <p className="font-semibold text-foreground text-sm mb-0.5">{step.title}</p>
                        <p className="text-muted-foreground text-sm leading-snug">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <section className="py-16 bg-background" data-testid="section-timeline">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">{t("results_page.timeline_label")}</p>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold">
                {t("results_page.timeline_heading_1")}<br />
                <span className="text-primary">{t("results_page.timeline_heading_2")}</span>
              </h2>
              <p className="mt-3 text-muted-foreground text-base max-w-xl">
                {t("results_page.timeline_sub")}
              </p>
            </RevealOnScroll>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {timelineCards.map((card, i) => (
                <RevealOnScroll key={i} delay={i * 0.1}>
                  <div
                    className="rounded-2xl border border-border bg-background overflow-hidden hover-elevate h-full flex flex-col"
                    data-testid={`card-timeline-${i}`}
                  >
                    <div className="aspect-[16/9] overflow-hidden flex-shrink-0">
                      <img
                        src={card.img}
                        alt={card.imgAlt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 self-start", card.color, card.textColor)}>
                        <Clock className="w-3 h-3" />
                        {card.period}
                      </div>
                      <ul className="space-y-2 flex-1">
                        {card.items.map((item, j) => (
                          <li key={j} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                            <p className="text-sm text-foreground/75 leading-snug">{item}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section className="py-16 bg-primary" data-testid="section-cta">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <RevealOnScroll>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-white" data-testid="text-results-cta">
                {t("results_page.cta_heading")}
              </h2>
              <p className="mt-4 text-white/80 text-lg max-w-xl mx-auto">
                {t("results_page.cta_sub")}
              </p>
              <Button
                size="lg"
                variant="outline"
                className="mt-8 bg-white text-primary border-white"
                onClick={onBookCall}
                data-testid="button-results-cta"
              >
                {t("results_page.cta_button")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </RevealOnScroll>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
