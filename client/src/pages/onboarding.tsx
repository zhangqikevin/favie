import { useLocation } from "wouter";
import { Loader2, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { plans } from "@/data/plans";
import { useState } from "react";
import { cn } from "@/lib/utils";

const agentColors = ["bg-blue-600", "bg-amber-500", "bg-purple-600", "bg-teal-600"];

function AgentDots({ count }: { count: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center",
            i < count ? agentColors[i] : "bg-border"
          )}
        >
          {i < count && <Zap className="w-2.5 h-2.5 text-white" />}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const { user, isLoading, selectPlan, logout } = useAuth();
  const [, navigate] = useLocation();
  const [selecting, setSelecting] = useState<string | null>(null);

  if (!isLoading && !user) {
    navigate("/login");
    return null;
  }

  // Where to land after onboarding: hired anyone yet? → agents page; otherwise Task Market.
  const postOnboardingPath = (): string => {
    try {
      const hired = JSON.parse(localStorage.getItem("favie_hired_agents") || "[]");
      return Array.isArray(hired) && hired.length > 0 ? "/admin/agents/expert" : "/admin/task-market";
    } catch {
      return "/admin/task-market";
    }
  };

  if (!isLoading && user?.selectedPlan) {
    navigate(postOnboardingPath());
    return null;
  }

  const handleSelect = async (planId: string) => {
    setSelecting(planId);
    try {
      await selectPlan(planId);
      navigate(postOnboardingPath());
    } catch {
      setSelecting(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-sm text-muted-foreground mb-2">
            Welcome, <span className="text-foreground font-medium">{user?.email}</span>
          </p>
          <h1 className="font-serif text-4xl font-bold text-foreground mb-3">
            Hire Your AI Agents
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Choose how many AI agents you want to hire. You can add more anytime as your business grows.
          </p>
        </div>

        {/* 30-day trial guarantee */}
        <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-6 py-4 mb-10">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">30-day free trial.</span>{" "}
            <span className="text-muted-foreground">No contracts. Cancel or change your plan anytime.</span>
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative bg-card rounded-2xl overflow-hidden flex flex-col transition-shadow duration-200",
                plan.popular
                  ? "ring-2 ring-primary shadow-md"
                  : "border border-border hover:shadow-sm"
              )}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-xs font-semibold text-center py-1.5 tracking-wide">
                  Most Popular
                </div>
              )}

              <div className="px-6 pt-6 pb-5 flex flex-col flex-1">
                {/* Agent dots */}
                <AgentDots count={plan.agentCount} />

                {/* Count + label */}
                <div className="mt-5 mb-1">
                  <span className="font-serif text-5xl font-bold text-foreground leading-none">
                    {plan.agentCount}
                  </span>
                </div>
                <p className="text-sm font-semibold text-muted-foreground mb-4">
                  {plan.agentCount === 1 ? "AI Agent" : "AI Agents"}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-serif text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
                <p className="text-xs font-medium text-primary mb-3">{plan.tagline}</p>

                {/* Desc */}
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{plan.desc}</p>

                {/* CTA */}
                <Button
                  className="w-full mt-6"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSelect(plan.id)}
                  disabled={selecting !== null}
                  data-testid={`button-select-plan-${plan.id}`}
                >
                  {selecting === plan.id ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Selecting…</>
                  ) : (
                    "Choose This Setup"
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Not sure which setup fits?{" "}
          <a href="/contact" className="text-primary hover:underline">Talk to us</a>
          {" · "}
          <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground hover:underline">
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
