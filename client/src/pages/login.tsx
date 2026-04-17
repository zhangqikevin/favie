import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
import { Utensils, Loader2, Zap, TrendingUp, Star, RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/lib/auth-context";
import { loginSchema, type LoginForm } from "@shared/schema";
import { useState } from "react";
import ThinkingScreen from "@/components/thinking-screen";
import { useTranslation } from "react-i18next";

const heroImage =
  "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80";

export default function Login() {
  const { login, user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [serverError, setServerError] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const { t } = useTranslation();

  const highlights = [
    { icon: TrendingUp, text: t("login.hl1") },
    { icon: Star,       text: t("login.hl2") },
    { icon: RotateCcw,  text: t("login.hl3") },
  ];

  const nextPath = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("next") || ""
    : "";

  // Default landing page after login depends on whether the user has hired any agents.
  // No hires yet → drop them into the Task Market so they can pick something.
  const defaultLanded = (): string => {
    try {
      const hired = JSON.parse(localStorage.getItem("favie_hired_agents") || "[]");
      return Array.isArray(hired) && hired.length > 0 ? "/admin/agents/expert" : "/admin/task-market";
    } catch {
      return "/admin/task-market";
    }
  };

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (!isLoading && user) {
    navigate(nextPath || (user.selectedPlan ? defaultLanded() : "/onboarding"));
    return null;
  }

  if (isThinking) return <ThinkingScreen />;

  const onSubmit = async (data: LoginForm) => {
    setServerError("");
    try {
      const loggedInUser = await login(data.email, data.password);
      sessionStorage.setItem("fromLogin", "1");
      setIsThinking(true);
      setTimeout(() => {
        navigate(nextPath || (loggedInUser.selectedPlan ? defaultLanded() : "/onboarding"));
      }, 2000);
    } catch (err: any) {
      setServerError(err.message || "Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col">
        <img
          src={heroImage}
          alt="Restaurant dining"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/65 to-black/45" />

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-auto">
            <Utensils className="w-6 h-6 text-primary" />
            <div className="flex flex-col leading-none">
              <span className="font-serif font-bold text-2xl text-white">Favie</span>
              <span className="text-[11px] text-white/60 font-medium tracking-wide mt-0.5">{t("common.tagline")}</span>
            </div>
          </Link>

          {/* Copy */}
          <div className="my-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-white/90 text-xs font-medium">{t("login.badge")}</span>
            </div>

            <h1 className="font-serif text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              {t("login.headline")}<br />
              <span className="text-primary">{t("login.headline2")}</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-md">
              {t("login.sub")}
            </p>

            {/* Highlights */}
            <ul className="space-y-4">
              {highlights.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-white/80 text-sm leading-snug pt-1">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-white/30 text-xs mt-auto pt-6">
            {t("common.trusted")}
          </p>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Utensils className="w-5 h-5 text-primary" />
            <span className="font-serif text-xl font-bold text-foreground">Favie</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="font-serif text-3xl font-bold text-foreground">{t("login.heading")}</h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {t("login.console")}
            </p>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("login.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("login.email_ph")}
                        data-testid="input-login-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("login.password")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t("login.password_ph")}
                        data-testid="input-login-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && (
                <p className="text-sm text-destructive" data-testid="text-login-error">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full mt-1"
                disabled={form.formState.isSubmitting}
                data-testid="button-login-submit"
              >
                {form.formState.isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("login.signing_in")}</>
                ) : (
                  <>{t("login.sign_in")} <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </form>
          </Form>

          {/* Divider + register link */}
          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              {t("login.no_account")}{" "}
              <Link href="/register" className="text-primary font-medium hover:underline" data-testid="link-go-to-register">
                {t("login.start_trial")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
