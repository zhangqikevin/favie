import { useParams, Link } from "wouter";
import { ArrowRight, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { getServiceBySlug, services } from "@/data/services";
import { useBookCall } from "@/lib/book-call-context";

export default function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const service = getServiceBySlug(slug ?? "");
  const onBookCall = useBookCall();

  if (!service) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <h1 className="font-serif text-3xl font-bold" data-testid="text-service-not-found">
            Service Not Found
          </h1>
          <p className="text-muted-foreground">We couldn't find that service page.</p>
          <Button asChild>
            <Link href="/services">View All Services</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const related = services.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <div className="min-h-screen" data-testid={`page-service-${service.slug}`}>
      <Header />

      <section className="pt-32 pb-0 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/services" className="hover-elevate text-foreground/70">
              Services
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground">{service.shortTitle}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start pb-12">
            <div className="lg:col-span-3">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${service.color}`}>
                <service.icon className="w-7 h-7" />
              </div>
              <Badge variant="secondary" className="mb-4">Service</Badge>
              <h1
                className="font-serif text-4xl sm:text-5xl font-bold text-foreground leading-tight"
                data-testid="text-service-title"
              >
                {service.fullTitle}
              </h1>
              <p className="mt-3 text-primary font-semibold text-lg" data-testid="text-service-tagline">
                {service.tagline}
              </p>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed" data-testid="text-service-positioning">
                {service.positioning}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={onBookCall} data-testid="button-service-book-call">
                  {service.ctaText}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/services" data-testid="link-service-all-services">
                    All Services
                  </Link>
                </Button>
              </div>

              <div className="mt-8 pt-8 border-t border-border">
                <h2 className="font-serif text-xl font-bold mb-3 text-foreground">The Problem</h2>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-service-problem">
                  {service.problem}
                </p>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-xl overflow-hidden aspect-[4/3] shadow-md">
                <img
                  src={service.heroImage}
                  alt={service.fullTitle}
                  className="w-full h-full object-cover"
                  loading="eager"
                  data-testid="img-service-hero"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <RevealOnScroll direction="left">
              <div>
                <Badge variant="secondary" className="mb-4">What We Do</Badge>
                <h2 className="font-serif text-3xl font-bold mb-6" data-testid="text-what-we-do">
                  How We Approach {service.shortTitle}
                </h2>
                <ul className="space-y-4">
                  {service.whatWeDo.map((item, i) => (
                    <li key={i} className="flex items-start gap-3" data-testid={`item-what-we-do-${i}`}>
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-foreground/85 leading-relaxed">{item}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealOnScroll>

            <RevealOnScroll direction="right">
              <div>
                <Badge variant="secondary" className="mb-4">Outcomes</Badge>
                <h2 className="font-serif text-3xl font-bold mb-6" data-testid="text-impact-headline">
                  What Clients Experience
                </h2>
                <div className="space-y-4">
                  {service.impact.map((item, i) => (
                    <div key={i} className="p-4 rounded-lg bg-card border" data-testid={`item-impact-${i}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${service.color}`}>
                          <service.icon className="w-4 h-4" />
                        </div>
                        <p className="text-foreground/85 leading-relaxed text-sm">{item}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <RevealOnScroll>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-white" data-testid="text-service-cta">
              Ready to Improve Your {service.shortTitle}?
            </h2>
            <p className="mt-4 text-white/85 text-lg">
              Book a consultation and we'll show you exactly how we'd approach this for your restaurant.
            </p>
            <Button
              size="lg"
              variant="outline"
              className="mt-8 bg-white text-primary border-white"
              onClick={onBookCall}
              data-testid="button-service-cta"
            >
              {service.ctaText}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </RevealOnScroll>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <RevealOnScroll>
            <h2 className="font-serif text-2xl font-bold mb-8" data-testid="text-related-headline">
              Related Services
            </h2>
          </RevealOnScroll>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {related.map((s, i) => (
              <RevealOnScroll key={s.slug} delay={i * 0.08}>
                <Link href={`/services/${s.slug}`} data-testid={`link-related-${s.slug}`}>
                  <Card className="h-full group cursor-pointer hover-elevate overflow-hidden">
                    <div className="aspect-[16/9] overflow-hidden">
                      <img
                        src={s.heroImage}
                        alt={s.shortTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="p-5">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-3 ${s.color}`}>
                        <s.icon className="w-4 h-4" />
                      </div>
                      <h3 className="font-semibold mb-1">{s.shortTitle}</h3>
                      <p className="text-muted-foreground text-xs leading-relaxed">{s.tagline}</p>
                      <p className="text-primary text-xs font-medium mt-3 flex items-center gap-1 group-hover:gap-2 transition-all">
                        Learn more <ChevronRight className="w-3 h-3" />
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
