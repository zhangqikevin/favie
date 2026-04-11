import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
import { Utensils, Loader2, CheckCircle2, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/lib/auth-context";
import { registerSchema, type RegisterForm } from "@shared/schema";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const heroImage =
  "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=1200&q=80";

export default function Register() {
  const { register: registerUser, user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();

  const benefits = [t("register.benefit1"), t("register.benefit2"), t("register.benefit3")];
  const stats = [
    { value: "+28%", label: t("register.stat_orders") },
    { value: "+41%", label: t("register.stat_visibility") },
    { value: "24/7", label: t("register.stat_monitoring") },
  ];

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  if (!isLoading && user) {
    navigate(user.selectedPlan ? "/dashboard" : "/onboarding");
    return null;
  }

  const onSubmit = async (data: RegisterForm) => {
    setServerError("");
    try {
      await registerUser(data.email, data.password);
      navigate("/onboarding");
    } catch (err: any) {
      setServerError(err.message || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col">
        {/* Background image */}
        <img
          src={heroImage}
          alt="Restaurant kitchen"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/65 to-black/50" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-auto">
            <Utensils className="w-6 h-6 text-primary" />
            <div className="flex flex-col leading-none">
              <span className="font-serif font-bold text-2xl text-white">Favie</span>
              <span className="text-[11px] text-white/60 font-medium tracking-wide mt-0.5">{t("common.tagline")}</span>
            </div>
          </Link>

          {/* Hero copy */}
          <div className="my-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-white/90 text-xs font-medium">{t("register.badge")}</span>
            </div>

            <h1 className="font-serif text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              {t("register.headline")}<br />
              <span className="text-primary">{t("register.headline2")}</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-md">
              {t("register.sub")}
            </p>

            {/* Benefits */}
            <ul className="space-y-3 mb-10">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-white/80 text-sm leading-snug">{b}</span>
                </li>
              ))}
            </ul>

            {/* Stats */}
            <div className="flex items-center gap-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="font-serif text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-white/50 text-xs mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust bar */}
          <p className="text-white/35 text-xs mt-auto pt-6">
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
            <h2 className="font-serif text-3xl font-bold text-foreground">{t("register.heading")}</h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {t("register.no_card_req")}
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
                    <FormLabel>{t("register.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("register.email_ph")}
                        data-testid="input-register-email"
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
                    <FormLabel>{t("register.password")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t("register.password_ph")}
                        data-testid="input-register-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("register.confirm")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t("register.confirm_ph")}
                        data-testid="input-register-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && (
                <p className="text-sm text-destructive" data-testid="text-register-error">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full mt-1"
                disabled={form.formState.isSubmitting}
                data-testid="button-register-submit"
              >
                {form.formState.isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("register.creating")}</>
                ) : (
                  <>{t("register.create_btn")} <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </form>
          </Form>

          {/* Trust signals */}
          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {[
              t("register.no_credit"),
              t("register.guarantee"),
              t("register.cancel"),
            ].map((label) => (
              <div key={label} className="bg-muted/50 rounded-lg px-2 py-2.5">
                <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Sign in link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("register.have_account")}{" "}
            <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-go-to-login">
              {t("register.sign_in")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
