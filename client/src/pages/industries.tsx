import { ArrowRight, Building2, Store, Rocket, ChefHat, Globe2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useBookCall } from "@/lib/book-call-context";
import { useTranslation } from "react-i18next";

export default function Industries() {
  const onBookCall = useBookCall();
  const { t } = useTranslation();

  const segments = [
    {
      icon: Store,
      title: t("industries.seg_independent_title"),
      subtitle: t("industries.seg_independent_subtitle"),
      img: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&q=80",
      imgAlt: "Independent restaurant dining room",
      shortHelp: t("industries.seg_independent_help"),
      services: [
        t("industries.service_delivery"),
        t("industries.service_social"),
        t("industries.service_reputation"),
        t("industries.service_loyalty"),
      ],
    },
    {
      icon: Building2,
      title: t("industries.seg_multi_title"),
      subtitle: t("industries.seg_multi_subtitle"),
      img: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=700&q=80",
      imgAlt: "Multi-location restaurant brand",
      shortHelp: t("industries.seg_multi_help"),
      services: [
        t("industries.service_delivery"),
        t("industries.service_menu"),
        t("industries.service_social"),
        t("industries.service_reputation"),
      ],
    },
    {
      icon: ChefHat,
      title: t("industries.seg_fastcasual_title"),
      subtitle: t("industries.seg_fastcasual_subtitle"),
      img: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&q=80",
      imgAlt: "Fast casual food ready to serve",
      shortHelp: t("industries.seg_fastcasual_help"),
      services: [
        t("industries.service_delivery"),
        t("industries.service_menu"),
        t("industries.service_loyalty"),
        t("industries.service_reputation"),
      ],
    },
    {
      icon: Rocket,
      title: t("industries.seg_launch_title"),
      subtitle: t("industries.seg_launch_subtitle"),
      img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&q=80",
      imgAlt: "Beautifully plated food for a new restaurant launch",
      shortHelp: t("industries.seg_launch_help"),
      services: [
        t("industries.service_delivery"),
        t("industries.service_social"),
        t("industries.service_influencer"),
        t("industries.service_reputation"),
      ],
    },
    {
      icon: Globe2,
      title: t("industries.seg_delivery_title"),
      subtitle: t("industries.seg_delivery_subtitle"),
      img: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=700&q=80",
      imgAlt: "Restaurant food prepared for delivery",
      shortHelp: t("industries.seg_delivery_help"),
      services: [
        t("industries.service_delivery"),
        t("industries.service_menu"),
        t("industries.service_reputation"),
      ],
    },
    {
      icon: Users,
      title: t("industries.seg_groups_title"),
      subtitle: t("industries.seg_groups_subtitle"),
      img: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=700&q=80",
      imgAlt: "Restaurant group management",
      shortHelp: t("industries.seg_groups_help"),
      services: [
        t("industries.service_delivery"),
        t("industries.service_social"),
        t("industries.service_influencer"),
        t("industries.service_loyalty"),
      ],
    },
  ];

  const adaptCards = [
    { title: t("industries.adapt_format_title"), desc: t("industries.adapt_format_desc") },
    { title: t("industries.adapt_stage_title"), desc: t("industries.adapt_stage_desc") },
    { title: t("industries.adapt_channel_title"), desc: t("industries.adapt_channel_desc") },
    { title: t("industries.adapt_scale_title"), desc: t("industries.adapt_scale_desc") },
  ];

  const imageStrip = [
    {
      src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
      alt: "Restaurant business analytics",
      label: t("industries.strip_label_1"),
    },
    {
      src: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
      alt: "Restaurant kitchen in operation",
      label: t("industries.strip_label_2"),
    },
    {
      src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
      alt: "Restaurant food",
      label: t("industries.strip_label_3"),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <main>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="pt-32 pb-16 bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="secondary" className="mb-4">{t("industries.badge")}</Badge>
                <h1
                  className="font-serif text-4xl sm:text-5xl font-bold text-foreground leading-tight"
                  data-testid="text-industries-headline"
                >
                  {t("industries.headline_1")} <span className="text-primary">{t("industries.headline_highlight")}</span><br className="hidden sm:block" /> {t("industries.headline_2")}
                </h1>
                <p className="mt-4 text-muted-foreground text-lg leading-relaxed max-w-lg">
                  {t("industries.hero_sub")}
                </p>
                <div className="mt-8">
                  <Button onClick={onBookCall} data-testid="button-industries-consult">
                    {t("industries.book_consultation")}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="rounded-2xl overflow-hidden shadow-lg aspect-[4/3]">
                  <img
                    src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=72"
                    alt="Restaurant dining room"
                    className="w-full h-full object-cover"
                    loading="eager"
                    data-testid="img-industries-hero"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Editorial image strip ───────────────────────────────────── */}
        <section className="py-10 bg-background border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-3 gap-4">
              {imageStrip.map((img, i) => (
                <RevealOnScroll key={i} delay={i * 0.08}>
                  <div className="overflow-hidden rounded-xl group">
                    <div className="aspect-[4/3] overflow-hidden">
                      <img
                        src={img.src}
                        alt={img.alt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-2.5 text-xs text-muted-foreground font-medium text-center">{img.label}</p>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── Six operator profiles ───────────────────────────────────── */}
        <section className="py-16 bg-background" data-testid="section-segments">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">{t("industries.profiles_label")}</p>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold">
                {t("industries.profiles_heading_1")} <span className="text-primary">{t("industries.profiles_heading_2")}</span>
              </h2>
            </RevealOnScroll>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {segments.map((seg, i) => (
                <RevealOnScroll key={i} delay={i * 0.07}>
                  <div
                    className="rounded-2xl border border-border bg-background hover-elevate overflow-hidden h-full flex flex-col"
                    data-testid={`card-segment-${i}`}
                  >
                    {/* Image header */}
                    <div className="aspect-[16/9] overflow-hidden relative flex-shrink-0">
                      <img
                        src={seg.img}
                        alt={seg.imgAlt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                      <div className="absolute bottom-3 left-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/90 flex items-center justify-center">
                          <seg.icon className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <h3
                        className="font-serif text-base font-bold text-foreground mb-1"
                        data-testid={`text-segment-title-${i}`}
                      >
                        {seg.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3 leading-snug">{seg.subtitle}</p>
                      <p className="text-sm text-foreground/80 leading-relaxed flex-1">{seg.shortHelp}</p>

                      {/* Service pills */}
                      <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-1.5">
                        {seg.services.map((service) => (
                          <Badge key={service} variant="secondary" className="text-xs font-normal">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── How we adapt ───────────────────────────────────────────── */}
        <section className="py-16 bg-card border-y border-border" data-testid="section-adapt">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Image */}
              <RevealOnScroll>
                <div className="rounded-2xl overflow-hidden aspect-[4/3] shadow-sm">
                  <img
                    src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=72"
                    alt="Restaurant dining room — premium atmosphere"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </RevealOnScroll>

              {/* Cards */}
              <RevealOnScroll delay={0.1}>
                <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">{t("industries.adapt_label")}</p>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-6">
                  {t("industries.adapt_heading_1")}<br />
                  <span className="text-primary">{t("industries.adapt_heading_2")}</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {adaptCards.map((card, i) => (
                    <div key={i} className="p-4 rounded-xl bg-background border border-border">
                      <p className="font-semibold text-foreground text-sm mb-1">{card.title}</p>
                      <p className="text-sm text-muted-foreground leading-snug">{card.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Button variant="outline" onClick={onBookCall} data-testid="button-adapt-cta">
                    {t("industries.adapt_cta_button")}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <section className="py-16 bg-primary" data-testid="section-cta">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <RevealOnScroll>
              <h2
                className="font-serif text-3xl md:text-4xl font-bold text-white"
                data-testid="text-industries-cta"
              >
                {t("industries.cta_heading")}
              </h2>
              <p className="mt-4 text-white/80 text-lg max-w-xl mx-auto">
                {t("industries.cta_sub")}
              </p>
              <Button
                size="lg"
                variant="outline"
                className="mt-8 bg-white text-primary border-white"
                onClick={onBookCall}
                data-testid="button-industries-cta"
              >
                {t("industries.cta_button")}
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
