import { Link } from "wouter";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { services } from "@/data/services";
import { useBookCall } from "@/lib/book-call-context";

export default function ServicesOverview() {
  const onBookCall = useBookCall();

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <section className="pt-32 pb-16 bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-4">Services</Badge>
              <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground" data-testid="text-services-overview-headline">
                Seven Service Lines. <span className="text-primary">One Growth System.</span>
              </h1>
              <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
                Each service line is designed to improve a specific dimension of restaurant
                revenue performance. They work individually — and compound when combined
                as part of a full-funnel engagement.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={onBookCall} data-testid="button-services-overview-consult">
                  Book a Consultation
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/contact" data-testid="link-services-overview-contact">
                    Contact Us
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
              {services.map((service, i) => (
                <RevealOnScroll key={service.slug} delay={i * 0.04}>
                  <Link href={`/services/${service.slug}`} data-testid={`link-service-row-${service.slug}`}>
                    <Card className="group cursor-pointer hover-elevate overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          <div className="sm:w-40 md:w-52 flex-shrink-0 overflow-hidden">
                            <img
                              src={service.heroImage}
                              alt={service.shortTitle}
                              className="w-full h-36 sm:h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 p-5 md:p-7">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${service.color}`}>
                              <service.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h2 className="font-serif text-lg font-bold text-foreground mb-1">
                                {service.fullTitle}
                              </h2>
                              <p className="text-primary text-sm font-medium mb-1.5">{service.tagline}</p>
                              <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
                                {service.positioning}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <div className="flex items-center gap-1 text-primary font-medium text-sm group-hover:gap-2 transition-all">
                                Learn more <ChevronRight className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-primary">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <RevealOnScroll>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-white" data-testid="text-services-cta">
                Not sure where to start?
              </h2>
              <p className="mt-4 text-white/85 text-lg">
                Book a consultation and we'll identify the highest-leverage service lines
                for your specific restaurant and growth stage.
              </p>
              <Button
                size="lg"
                variant="outline"
                className="mt-8 bg-white text-primary border-white"
                onClick={onBookCall}
                data-testid="button-services-cta"
              >
                Book a Growth Consultation
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
