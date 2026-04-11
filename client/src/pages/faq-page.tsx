import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useBookCall } from "@/lib/book-call-context";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0" data-testid={`faq-item-${index}`}>
      <button
        className="w-full flex items-center justify-between py-4 text-left gap-4"
        onClick={() => setOpen(!open)}
        data-testid={`faq-toggle-${index}`}
      >
        <span className="font-medium text-foreground">{q}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform",
            open ? "rotate-180" : ""
          )}
        />
      </button>
      {open && (
        <p className="pb-4 text-muted-foreground text-sm leading-relaxed" data-testid={`faq-answer-${index}`}>
          {a}
        </p>
      )}
    </div>
  );
}

export default function FaqPage() {
  const onBookCall = useBookCall();
  const { t } = useTranslation();
  let globalIndex = 0;

  const faqCategories = [
    {
      category: t("faq.cat_working_title"),
      items: [
        { q: t("faq.working_q1"), a: t("faq.working_a1") },
        { q: t("faq.working_q2"), a: t("faq.working_a2") },
        { q: t("faq.working_q3"), a: t("faq.working_a3") },
        { q: t("faq.working_q4"), a: t("faq.working_a4") },
      ],
    },
    {
      category: t("faq.cat_services_title"),
      items: [
        { q: t("faq.services_q1"), a: t("faq.services_a1") },
        { q: t("faq.services_q2"), a: t("faq.services_a2") },
        { q: t("faq.services_q3"), a: t("faq.services_a3") },
        { q: t("faq.services_q4"), a: t("faq.services_a4") },
      ],
    },
    {
      category: t("faq.cat_performance_title"),
      items: [
        { q: t("faq.performance_q1"), a: t("faq.performance_a1") },
        { q: t("faq.performance_q2"), a: t("faq.performance_a2") },
        { q: t("faq.performance_q3"), a: t("faq.performance_a3") },
      ],
    },
    {
      category: t("faq.cat_contracts_title"),
      items: [
        { q: t("faq.contracts_q1"), a: t("faq.contracts_a1") },
        { q: t("faq.contracts_q2"), a: t("faq.contracts_a2") },
        { q: t("faq.contracts_q3"), a: t("faq.contracts_a3") },
      ],
    },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <section className="pt-32 pb-16 bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-4">{t("faq.badge")}</Badge>
              <h1
                className="font-serif text-4xl sm:text-5xl font-bold text-foreground"
                data-testid="text-faq-headline"
              >
                {t("faq.headline_1")} <span className="text-primary">{t("faq.headline_highlight")}</span>
              </h1>
              <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
                {t("faq.hero_sub")}
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-background">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-12">
              {faqCategories.map((cat, ci) => (
                <RevealOnScroll key={ci} delay={ci * 0.05}>
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground mb-4" data-testid={`faq-category-${ci}`}>
                      {cat.category}
                    </h2>
                    <div className="rounded-lg bg-card border overflow-hidden px-4">
                      {cat.items.map((item) => {
                        const idx = globalIndex++;
                        return <FAQItem key={idx} q={item.q} a={item.a} index={idx} />;
                      })}
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-primary">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <RevealOnScroll>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-white" data-testid="text-faq-cta">
                {t("faq.cta_heading")}
              </h2>
              <p className="mt-4 text-white/85 text-lg">
                {t("faq.cta_sub")}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white text-primary border-white"
                  onClick={onBookCall}
                  data-testid="button-faq-book-call"
                >
                  {t("faq.cta_button")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
