import AdminLayout from "@/components/admin-layout";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Zap, TrendingUp, ChevronRight, CheckCircle2, Clock,
  AlertCircle, BadgeCheck, SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const budgetData = {
  current: 2500,
  recommended: 3200,
  currency: "$",
  rationale:
    "Based on recent conversion trends on Uber Eats and DoorDash, increasing the monthly budget limit to $3,200 could help capture more high-intent traffic during lunch and dinner peaks.",
};

const forecastScenarios = [
  {
    id: "current",
    label: "Current Budget",
    budget: 2500,
    clicks: "4,200",
    orders: "320",
    revenue: "$7,100",
    highlight: false,
  },
  {
    id: "recommended",
    label: "Recommended",
    budget: 3200,
    clicks: "5,300",
    orders: "405",
    revenue: "$9,200",
    highlight: true,
  },
  {
    id: "growth",
    label: "Growth Scenario",
    budget: 4000,
    clicks: "6,100",
    orders: "470",
    revenue: "$10,600",
    highlight: false,
  },
];

const channelData = [
  {
    id: "ubereats",
    name: "Uber Eats",
    color: "bg-green-500",
    fields: [
      { label: "Spend", value: "$1,420" },
      { label: "Store Visits", value: "2,840" },
      { label: "Orders", value: "196" },
      { label: "Conversion Rate", value: "6.9%" },
      { label: "Revenue Influenced", value: "$4,380" },
      { label: "Trend vs Prior Period", value: "+11.2%", positive: true },
    ],
  },
  {
    id: "doordash",
    name: "DoorDash",
    color: "bg-red-500",
    fields: [
      { label: "Spend", value: "$980" },
      { label: "Store Visits", value: "2,060" },
      { label: "Orders", value: "124" },
      { label: "Conversion Rate", value: "6.0%" },
      { label: "Revenue Influenced", value: "$2,720" },
      { label: "Trend vs Prior Period", value: "+7.4%", positive: true },
    ],
  },
];

const trendData = [
  { week: "Week 1", spend: 520, orders: 68, revenue: 1420 },
  { week: "Week 2", spend: 610, orders: 79, revenue: 1760 },
  { week: "Week 3", spend: 590, orders: 82, revenue: 1890 },
  { week: "Week 4", spend: 680, orders: 91, revenue: 2030 },
];

const promotions = [
  {
    id: 1,
    type: "BOGO",
    name: "Buy 1 Get 1 Free Milk Tea",
    platform: "Uber Eats",
    goal: "Increase afternoon traffic",
    status: "Active",
    result: "+18% beverage add-on rate",
  },
  {
    id: 2,
    type: "Combo",
    name: "Lunch Combo A + Drink",
    platform: "DoorDash",
    goal: "Improve average order value",
    status: "Active",
    result: "+11% avg ticket increase",
  },
  {
    id: 3,
    type: "Discount",
    name: "15% Off Orders Above $25",
    platform: "Uber Eats + DoorDash",
    goal: "Push larger basket sizes",
    status: "Completed",
    result: "+9% order value during campaign window",
  },
  {
    id: 4,
    type: "Storefront",
    name: "New Hero Image + Bestseller Highlights",
    platform: "Uber Eats",
    goal: "Improve conversion from store visit to order",
    status: "Completed",
    result: "+0.8 pt conversion lift",
  },
];

const aiActions = [
  "Shifted more spend to Uber Eats lunch window based on stronger conversion",
  "Reduced low-performing late-night spend on DoorDash",
  "Promoted Family Combo A to increase basket size",
  "Tested BOGO Milk Tea to improve add-on behavior",
];

const aiRecommendations = [
  "Raise monthly budget limit from $2,500 to $3,200 to capture missed peak-hour demand",
  "Expand combo-based promotions because avg order value is trending up",
  "Continue beverage-focused offers because add-on conversion is improving",
];

const keyTakeaways = [
  "Uber Eats is currently generating the strongest return",
  "Combo offers are increasing average order value",
  "Beverage promotions are improving add-on behavior",
  "Current budget may be limiting growth during peak demand windows",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-xl font-bold text-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

function statusBadge(status: string) {
  if (status === "Active") return <Badge className="bg-green-100 text-green-700 border-0 text-sm">Active</Badge>;
  return <Badge variant="outline" className="text-sm text-muted-foreground">Completed</Badge>;
}

function typeColor(type: string) {
  const map: Record<string, string> = {
    BOGO: "bg-purple-100 text-purple-700",
    Combo: "bg-blue-100 text-blue-700",
    Discount: "bg-amber-100 text-amber-700",
    Storefront: "bg-primary/10 text-primary",
  };
  return map[type] ?? "bg-muted text-muted-foreground";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDelivery() {
  const [budget, setBudget] = useState(budgetData.current);
  const [inputValue, setInputValue] = useState(String(budgetData.current));
  const [saved, setSaved] = useState(false);

  const gap = budgetData.recommended - budget;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleUseRecommended = () => {
    setBudget(budgetData.recommended);
    setInputValue(String(budgetData.recommended));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">AI-Managed</span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Delivery Ads & Storefront</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          AI manages your delivery growth automatically. You only control the monthly budget limit.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* ══════════════════════════════════════════════════════════════════
            1. Budget Control Panel
        ══════════════════════════════════════════════════════════════════ */}
        <section data-testid="section-budget-control">
          <SectionHeader
            title="Budget Control Panel"
            description="Set your monthly maximum spend. The AI allocates and optimizes everything within this limit."
          />
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Top row: numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
              <div className="px-6 py-5">
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Current Monthly Limit</p>
                <p className="font-serif text-3xl font-bold text-foreground">${budget.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Your set maximum spend</p>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">AI Recommended</p>
                <p className="font-serif text-3xl font-bold text-primary">${budgetData.recommended.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Based on platform data</p>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Gap</p>
                <p className={cn("font-serif text-3xl font-bold", gap > 0 ? "text-amber-600" : "text-green-600")}>
                  {gap > 0 ? "+" : ""}{gap === 0 ? "—" : `$${Math.abs(gap).toLocaleString()}`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {gap > 0 ? "Recommended increase" : gap < 0 ? "Above recommendation" : "At recommended level"}
                </p>
              </div>
            </div>

            {/* AI rationale */}
            <div className="px-6 py-4 bg-primary/5 border-t border-border flex items-start gap-3">
              <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80 leading-relaxed">{budgetData.rationale}</p>
            </div>

            {/* Budget input + CTAs */}
            <div className="px-6 py-5 border-t border-border flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Monthly limit:</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={() => setBudget(Number(inputValue) || budget)}
                    className="pl-7 pr-3 py-1.5 text-sm border border-border rounded-md w-28 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    data-testid="input-budget-limit"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} data-testid="button-save-budget">
                  {saved ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Saved</> : "Update Budget Limit"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleUseRecommended} data-testid="button-use-recommended">
                  Use Recommended ($3,200)
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            2. Budget Impact Forecast
        ══════════════════════════════════════════════════════════════════ */}
        <section data-testid="section-forecast">
          <SectionHeader
            title="Budget Impact Forecast"
            description="Estimated outcomes at different monthly spend levels, based on current platform performance."
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            {forecastScenarios.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-xl border p-5",
                  s.highlight
                    ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                    : "bg-card border-border"
                )}
                data-testid={`card-forecast-${s.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</span>
                  {s.highlight && (
                    <span className="text-sm font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      AI Pick
                    </span>
                  )}
                </div>
                <p className="font-serif text-2xl font-bold text-foreground mb-4">${s.budget.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <ul className="space-y-2">
                  {[
                    { label: "Est. monthly clicks", value: s.clicks },
                    { label: "Est. orders", value: s.orders },
                    { label: "Est. revenue influenced", value: s.revenue },
                  ].map((row) => (
                    <li key={row.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold text-foreground">{row.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground italic">
            Forecasts are AI-generated estimates based on recent platform performance, conversion trends, and historical promotion results.
          </p>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            3. Channel Performance Overview
        ══════════════════════════════════════════════════════════════════ */}
        <section data-testid="section-channels">
          <SectionHeader
            title="Channel Performance Overview"
            description="How each delivery platform is performing this period. AI is actively managing spend allocation across both channels."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {channelData.map((ch) => (
              <div key={ch.id} className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`card-channel-${ch.id}`}>
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", ch.color)} />
                  <span className="font-semibold text-sm text-foreground">{ch.name}</span>
                </div>
                <ul className="divide-y divide-border">
                  {ch.fields.map((f) => (
                    <li key={f.label} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-muted-foreground">{f.label}</span>
                      <span className={cn(
                        "text-sm font-semibold",
                        "positive" in f && f.positive ? "text-green-600" : "text-foreground"
                      )}>
                        {f.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            4. Spend & Performance Trend
        ══════════════════════════════════════════════════════════════════ */}
        <section data-testid="section-trend">
          <SectionHeader
            title="Spend & Performance Trend"
            description="Weekly breakdown showing whether increased spend is producing better results."
          />
          <div className="bg-card border border-border rounded-xl p-5">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(21,55%,50%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(21,55%,50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(128,15%,59%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(128,15%,59%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "revenue") return [`$${Number(value).toLocaleString()}`, "Revenue"];
                    if (name === "spend") return [`$${Number(value).toLocaleString()}`, "Spend"];
                    return [value, "Orders"];
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="spend" stroke="hsl(21,55%,50%)" fill="url(#gSpend)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="orders" stroke="hsl(128,15%,59%)" fill="url(#gRevenue)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(215,80%,55%)" fill="none" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            5. Storefront & Promotion Activity
        ══════════════════════════════════════════════════════════════════ */}
        <section data-testid="section-promotions">
          <SectionHeader
            title="Storefront & Promotion Activity"
            description="Promotions and storefront improvements launched or managed by the AI this period."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {promotions.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-xl p-5" data-testid={`card-promo-${p.id}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide", typeColor(p.type))}>
                      {p.type}
                    </span>
                    {statusBadge(p.status)}
                  </div>
                </div>
                <p className="font-semibold text-sm text-foreground mb-2 leading-snug">{p.name}</p>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-start gap-1.5">
                    <span className="uppercase tracking-wide text-sm w-16 flex-shrink-0 pt-0.5">Platform</span>
                    <span className="text-foreground/80">{p.platform}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="uppercase tracking-wide text-sm w-16 flex-shrink-0 pt-0.5">Goal</span>
                    <span className="text-foreground/80">{p.goal}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="uppercase tracking-wide text-sm w-16 flex-shrink-0 pt-0.5">Result</span>
                    <span className="text-green-700 font-medium">{p.result}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            6. AI Actions & Recommendations
        ══════════════════════════════════════════════════════════════════ */}
        <section data-testid="section-ai">
          <SectionHeader title="AI Actions & Recommendations" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Actions done */}
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">What AI Has Done</p>
              <ul className="space-y-3">
                {aiActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <p className="text-sm font-semibold text-primary uppercase tracking-wider">AI Recommends</p>
              </div>
              <ul className="space-y-3">
                {aiRecommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            7. Key Takeaways
        ══════════════════════════════════════════════════════════════════ */}
        <section data-testid="section-takeaways">
          <SectionHeader title="Key Takeaways" description="Plain-language summary of where things stand right now." />
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {keyTakeaways.map((t, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4">
                <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            8. Settings (minimal)
        ══════════════════════════════════════════════════════════════════ */}
        <section data-testid="section-settings" className="pb-10">
          <SectionHeader
            title="Settings"
            description="The only controls available to you. Everything else is managed automatically by the AI."
          />
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Monthly Budget Limit</p>
                <p className="text-sm text-muted-foreground mt-0.5">Maximum spend the AI can use per month</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">${budget.toLocaleString()}/mo</span>
                <Button size="sm" variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} data-testid="button-settings-adjust">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                  Adjust
                </Button>
              </div>
            </div>
            <div className="border-t border-border pt-4 mt-1">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Targeting, bidding, campaign structure, and creative decisions are fully managed by the AI and are not configurable here.</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </AdminLayout>
  );
}
