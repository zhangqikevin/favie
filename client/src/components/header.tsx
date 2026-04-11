import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Utensils, ChevronDown, ArrowRight, LayoutDashboard, Briefcase, ChefHat, Megaphone, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useBookCall } from "@/lib/book-call-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const navLinkDefs = [
  { key: "nav.who_we_serve", href: "/industries" },
  { key: "nav.results",      href: "/results" },
  { key: "nav.pricing",      href: "/pricing" },
  { key: "nav.about",        href: "/about" },
];

const agentNav = [
  {
    id: "operation",
    name: "Operation Agent",
    tagline: "Delivery growth, budget strategy, and promotion planning",
    icon: Briefcase,
    color: "bg-blue-600",
    textColor: "text-blue-700",
    iconBg: "bg-blue-100",
    tagBg: "bg-blue-50 text-blue-700",
    tags: ["Delivery Optimization", "Budget Recommendations", "Platform Promotions"],
  },
  {
    id: "chef",
    name: "Chef Agent",
    tagline: "New dish ideas and menu presentation improvements",
    icon: ChefHat,
    color: "bg-amber-500",
    textColor: "text-amber-700",
    iconBg: "bg-amber-100",
    tagBg: "bg-amber-50 text-amber-700",
    tags: ["Menu Improving", "New Dish Suggestions", "Image & Description Optimization"],
  },
  {
    id: "social",
    name: "Social Media Agent",
    tagline: "Content, engagement insights, and creator partnerships",
    icon: Megaphone,
    color: "bg-purple-600",
    textColor: "text-purple-700",
    iconBg: "bg-purple-100",
    tagBg: "bg-purple-50 text-purple-700",
    tags: ["Social Media Operation", "Influencer Collaboration", "Content Planning"],
  },
  {
    id: "customer",
    name: "Customer Service Agent",
    tagline: "Reviews, complaints, retention, and win-back actions",
    icon: Headphones,
    color: "bg-teal-600",
    textColor: "text-teal-700",
    iconBg: "bg-teal-100",
    tagBg: "bg-teal-50 text-teal-700",
    tags: ["Reviews & Reputation", "Complaint Follow-Up", "Loyalty Program"],
  },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const onBookCall = useBookCall();
  const { user } = useAuth();
  const [location] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();

  const isHome = location === "/";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerTransparent = isHome && !scrolled;

  function openDropdown() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setServicesOpen(true);
  }

  function closeDropdown() {
    timeoutRef.current = setTimeout(() => setServicesOpen(false), 120);
  }

  return (
    <header
      data-testid="header"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        headerTransparent
          ? "bg-transparent py-5"
          : "bg-card/95 backdrop-blur-md border-b border-border py-3 shadow-sm"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 flex-shrink-0"
          data-testid="link-logo"
        >
          <Utensils
            className={cn(
              "w-8 h-8 transition-colors flex-shrink-0",
              headerTransparent ? "text-white" : "text-primary"
            )}
          />
          <div className="flex flex-col leading-none">
            <span
              className={cn(
                "font-serif font-bold text-3xl transition-colors",
                headerTransparent ? "text-white" : "text-foreground"
              )}
            >
              Favie
            </span>
            <span
              className={cn(
                "text-xs font-semibold tracking-wide transition-colors mt-0.5",
                headerTransparent ? "text-white/70" : "text-muted-foreground"
              )}
            >
              {t("common.tagline")}
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1" data-testid="nav-desktop">
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={openDropdown}
            onMouseLeave={closeDropdown}
          >
            <button
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 rounded-md text-base font-semibold transition-colors hover-elevate",
                headerTransparent ? "text-white/90" : "text-foreground/80"
              )}
              data-testid="button-nav-solutions"
            >
              {t("nav.ai_agents")}
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform",
                  servicesOpen ? "rotate-180" : ""
                )}
              />
            </button>

            {servicesOpen && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card border border-border rounded-xl shadow-2xl w-[800px] overflow-hidden"
                onMouseEnter={openDropdown}
                onMouseLeave={closeDropdown}
                data-testid="dropdown-solutions"
              >
                <div className="flex">
                  {/* Left intro panel */}
                  <div className="w-[220px] flex-shrink-0 bg-foreground/[0.03] border-r border-border p-5 flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                        <Briefcase className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug mb-2">
                        {t("nav.meet_team")}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t("nav.team_desc")}
                      </p>
                    </div>
                    <div className="mt-6 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-xs text-muted-foreground">{t("nav.realtime")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-xs text-muted-foreground">{t("nav.always_on")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-xs text-muted-foreground">{t("nav.boardroom")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: 2×2 agent grid */}
                  <div className="flex-1 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {agentNav.map((agent) => (
                        <Link
                          key={agent.id}
                          href={`/agents/${agent.id}`}
                          onClick={() => setServicesOpen(false)}
                          className="group flex flex-col gap-2 p-3 rounded-lg border border-transparent hover:border-border hover:bg-background/60 hover-elevate transition-colors"
                          data-testid={`link-dropdown-agent-${agent.id}`}
                        >
                          {/* Icon + name row */}
                          <div className="flex items-center gap-2.5">
                            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0", agent.color)}>
                              <agent.icon className="w-3.5 h-3.5 text-white" />
                            </div>
                            <p className="text-sm font-semibold text-foreground leading-none">{agent.name}</p>
                          </div>
                          {/* Description */}
                          <p className="text-xs text-muted-foreground leading-snug">
                            {agent.tagline}
                          </p>
                          {/* Capability tags */}
                          <div className="flex flex-wrap gap-1">
                            {agent.tags.map((tag) => (
                              <span
                                key={tag}
                                className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", agent.tagBg)}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          {/* Learn more affordance */}
                          <p className={cn("text-[11px] font-semibold flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity", agent.textColor)}>
                            Learn more <ArrowRight className="w-3 h-3" />
                          </p>
                        </Link>
                      ))}
                    </div>

                    {/* Footer links */}
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-4">
                      <Link
                        href="/"
                        className="text-xs font-semibold text-primary flex items-center gap-1 hover-elevate"
                        onClick={() => setServicesOpen(false)}
                        data-testid="link-dropdown-all-agents"
                      >
                        {t("nav.explore_all")} <ArrowRight className="w-3 h-3" />
                      </Link>
                      <span className="text-border">|</span>
                      <Link
                        href="/services"
                        className="text-xs text-muted-foreground hover-elevate"
                        onClick={() => setServicesOpen(false)}
                        data-testid="link-dropdown-services"
                      >
                        {t("nav.view_capabilities")}
                      </Link>
                      <span className="text-border">|</span>
                      <Link
                        href="/about"
                        className="text-xs text-muted-foreground hover-elevate"
                        onClick={() => setServicesOpen(false)}
                        data-testid="link-dropdown-platform"
                      >
                        {t("nav.see_platform")}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {navLinkDefs.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-4 py-2.5 rounded-md text-base font-semibold transition-colors hover-elevate",
                headerTransparent ? "text-white/90" : "text-foreground/80"
              )}
              data-testid={`link-nav-${t(link.key).toLowerCase().replace(/\s+/g, "-")}`}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="link-nav-dashboard">
              <Link href="/dashboard">
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                {t("common.dashboard")}
              </Link>
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                asChild
                className={cn("text-base font-semibold", headerTransparent ? "text-white/90 hover:text-white hover:bg-white/10" : "")}
                data-testid="link-nav-login"
              >
                <Link href="/login">{t("common.login")}</Link>
              </Button>
              <Button asChild data-testid="link-nav-register">
                <Link href="/register">{t("common.start_free_trial")}</Link>
              </Button>
            </>
          )}
        </div>

        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                data-testid="button-mobile-menu"
                className={headerTransparent ? "text-white" : "text-foreground"}
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-card flex flex-col">
              <SheetTitle className="font-serif text-left">{t("nav.menu")}</SheetTitle>
              <div className="flex flex-col gap-1 mt-4 flex-1">
                <button
                  className="flex items-center justify-between px-3 py-3 rounded-md text-foreground/80 font-medium text-left hover-elevate"
                  onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                  data-testid="button-mobile-solutions"
                >
                  <span>{t("nav.ai_agents")}</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform",
                      mobileServicesOpen ? "rotate-180" : ""
                    )}
                  />
                </button>

                {mobileServicesOpen && (
                  <div className="ml-3 pl-3 border-l border-border space-y-1">
                    {agentNav.map((agent) => (
                      <Link
                        key={agent.id}
                        href={`/agents/${agent.id}`}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2.5 py-2 px-2 text-sm text-muted-foreground hover-elevate rounded-md"
                        data-testid={`link-mobile-agent-${agent.id}`}
                      >
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0", agent.color)}>
                          <agent.icon className="w-3 h-3 text-white" />
                        </div>
                        {agent.name}
                      </Link>
                    ))}
                  </div>
                )}

                {navLinkDefs.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-3 rounded-md text-foreground/80 font-medium hover-elevate"
                    data-testid={`link-mobile-${t(link.key).toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {t(link.key)}
                  </Link>
                ))}
                <Link
                  href="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-3 rounded-md text-foreground/80 font-medium hover-elevate"
                  data-testid="link-mobile-contact"
                >
                  {t("common.contact")}
                </Link>
              </div>
              <div className="pt-4 border-t border-border space-y-2">
                {user ? (
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" asChild data-testid="link-mobile-dashboard">
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      {t("common.dashboard")}
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" className="w-full" asChild data-testid="link-mobile-login">
                      <Link href="/login" onClick={() => setMobileOpen(false)}>{t("common.login")}</Link>
                    </Button>
                    <Button className="w-full" asChild data-testid="link-mobile-register">
                      <Link href="/register" onClick={() => setMobileOpen(false)}>{t("common.start_free_trial")}</Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
