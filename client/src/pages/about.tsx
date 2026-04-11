import { ArrowRight, Briefcase, ChefHat, Megaphone, Headphones, Layers, Zap, GitMerge, Eye, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useBookCall } from "@/lib/book-call-context";
import { useTranslation } from "react-i18next";

export default function About() {
  const onBookCall = useBookCall();
  const { t } = useTranslation();

  const agents = [
    {
      icon: Briefcase,
      name: t("about.agent_op_name"),
      color: "bg-blue-600",
      lightBg: "bg-blue-50",
      textColor: "text-blue-700",
      role: t("about.agent_op_role"),
      tasks: [t("about.agent_op_task1"), t("about.agent_op_task2"), t("about.agent_op_task3")],
    },
    {
      icon: ChefHat,
      name: t("about.agent_chef_name"),
      color: "bg-amber-500",
      lightBg: "bg-amber-50",
      textColor: "text-amber-700",
      role: t("about.agent_chef_role"),
      tasks: [t("about.agent_chef_task1"), t("about.agent_chef_task2"), t("about.agent_chef_task3")],
    },
    {
      icon: Megaphone,
      name: t("about.agent_social_name"),
      color: "bg-purple-600",
      lightBg: "bg-purple-50",
      textColor: "text-purple-700",
      role: t("about.agent_social_role"),
      tasks: [t("about.agent_social_task1"), t("about.agent_social_task2"), t("about.agent_social_task3")],
    },
    {
      icon: Headphones,
      name: t("about.agent_customer_name"),
      color: "bg-teal-600",
      lightBg: "bg-teal-50",
      textColor: "text-teal-700",
      role: t("about.agent_customer_role"),
      tasks: [t("about.agent_customer_task1"), t("about.agent_customer_task2"), t("about.agent_customer_task3")],
    },
  ];

  const agentAdvantages = [
    {
      icon: Eye,
      title: t("about.adv_monitoring_title"),
      desc: t("about.adv_monitoring_desc"),
    },
    {
      icon: Zap,
      title: t("about.adv_faster_title"),
      desc: t("about.adv_faster_desc"),
    },
    {
      icon: GitMerge,
      title: t("about.adv_coordinated_title"),
      desc: t("about.adv_coordinated_desc"),
    },
    {
      icon: Layers,
      title: t("about.adv_less_execution_title"),
      desc: t("about.adv_less_execution_desc"),
    },
  ];

  const whySystem = [
    t("about.why_system_1"),
    t("about.why_system_2"),
    t("about.why_system_3"),
    t("about.why_system_4"),
    t("about.why_system_5"),
    t("about.why_system_6"),
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <main>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="pt-32 pb-16 bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-4">{t("about.badge")}</Badge>
              <h1
                className="font-serif text-4xl sm:text-5xl font-bold text-foreground leading-tight"
                data-testid="text-about-headline"
              >
                {t("about.headline_1")} <span className="text-primary">{t("about.headline_highlight")}</span>{t("about.headline_2")}
              </h1>
              <p className="mt-5 text-muted-foreground text-lg leading-relaxed max-w-2xl">
                {t("about.hero_p1")}
              </p>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed max-w-2xl">
                {t("about.hero_p2")}
              </p>
            </div>
          </div>
        </section>

        {/* ── Four agents, one system ───────────────────────────────────────── */}
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              <RevealOnScroll direction="left">
                <div>
                  <Badge variant="secondary" className="mb-4">{t("about.how_it_works_badge")}</Badge>
                  <h2 className="font-serif text-3xl font-bold mb-4" data-testid="text-about-philosophy">
                    {t("about.four_agents_heading")}
                  </h2>
                  <div className="space-y-4 text-muted-foreground leading-relaxed">
                    <p>{t("about.four_agents_p1")}</p>
                    <p>{t("about.four_agents_p2")}</p>
                    <p>{t("about.four_agents_p3")}</p>
                  </div>
                </div>
              </RevealOnScroll>

              <RevealOnScroll direction="right">
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden aspect-[16/9] shadow-md">
                    <img
                      src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=72"
                      alt="Restaurant food — the result of coordinated growth"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      data-testid="img-about-philosophy"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="bg-primary text-white border-0">
                      <CardContent className="p-6">
                        <Layers className="w-8 h-8 mb-4 text-white/80" />
                        <h3 className="font-serif text-xl font-bold mb-2">{t("about.card_four_agents_title")}</h3>
                        <p className="text-white/80 text-sm leading-relaxed">
                          {t("about.card_four_agents_desc")}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <GitMerge className="w-8 h-8 mb-4 text-primary" />
                        <h3 className="font-serif text-xl font-bold mb-2">{t("about.card_whatsapp_title")}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {t("about.card_whatsapp_desc")}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </RevealOnScroll>

            </div>
          </div>
        </section>

        {/* ── Meet the agents ───────────────────────────────────────────────── */}
        <section className="py-16 bg-card border-y border-border" data-testid="section-agents">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10 text-center max-w-2xl mx-auto">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">{t("about.agent_team_label")}</p>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold">
                {t("about.agent_team_heading_1")} <span className="text-primary">{t("about.agent_team_heading_2")}</span>
              </h2>
              <p className="mt-3 text-muted-foreground text-base">
                {t("about.agent_team_desc")}
              </p>
            </RevealOnScroll>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {agents.map((agent, i) => (
                <RevealOnScroll key={i} delay={i * 0.08}>
                  <div
                    className="rounded-2xl border border-border bg-background p-5 hover-elevate h-full flex flex-col"
                    data-testid={`card-agent-${i}`}
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 flex-shrink-0", agent.color)}>
                      <agent.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-serif font-bold text-foreground text-base mb-1">{agent.name}</h3>
                    <p className={cn("text-xs font-medium mb-4 leading-snug", agent.textColor)}>{agent.role}</p>
                    <ul className="space-y-1.5 flex-1">
                      {agent.tasks.map((task) => (
                        <li key={task} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why AI agents work better ─────────────────────────────────────── */}
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="max-w-3xl mx-auto text-center mb-10">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">{t("about.agent_advantage_label")}</p>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold" data-testid="text-about-values">
                {t("about.agent_advantage_heading_1")}<br />
                <span className="text-primary">{t("about.agent_advantage_heading_2")}</span>
              </h2>
            </RevealOnScroll>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {agentAdvantages.map((adv, i) => (
                <RevealOnScroll key={i} delay={i * 0.08}>
                  <Card data-testid={`card-advantage-${i}`}>
                    <CardContent className="p-6">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                        <adv.icon className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground text-base mb-2">{adv.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{adv.desc}</p>
                    </CardContent>
                  </Card>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why fragmented approaches fall short ─────────────────────────── */}
        <section className="py-16 bg-card border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

              <RevealOnScroll direction="left">
                <div>
                  <Badge variant="secondary" className="mb-4">{t("about.why_system_badge")}</Badge>
                  <h2 className="font-serif text-3xl font-bold mb-3" data-testid="text-about-diff">
                    {t("about.why_system_heading_1")}<br />{t("about.why_system_heading_2")}
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    {t("about.why_system_sub")}
                  </p>
                  <ul className="space-y-3">
                    {whySystem.map((d, i) => (
                      <li key={i} className="flex items-start gap-3" data-testid={`item-diff-${i}`}>
                        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-foreground/80 text-sm leading-relaxed">{d}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </RevealOnScroll>

              <RevealOnScroll direction="right">
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden aspect-[16/9] shadow-sm">
                    <img
                      src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=72"
                      alt="Premium restaurant dining environment"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="bg-primary rounded-2xl p-8 text-white">
                    <h3 className="font-serif text-2xl font-bold mb-3">{t("about.cta_heading")}</h3>
                    <p className="text-white/80 text-sm leading-relaxed mb-6">
                      {t("about.cta_desc")}
                    </p>
                    <Button
                      variant="outline"
                      className="bg-white text-primary border-white"
                      onClick={onBookCall}
                      data-testid="button-about-consult"
                    >
                      {t("about.cta_button")}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </RevealOnScroll>

            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
