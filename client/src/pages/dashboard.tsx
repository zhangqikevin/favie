import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/admin-layout";
import { useAuth } from "@/lib/auth-context";
import ThinkingScreen from "@/components/thinking-screen";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RestaurantSetupFlow from "@/components/restaurant-setup-flow";
import type { Restaurant } from "@shared/schema";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Zap, Send, CheckCircle2, ChevronRight, ChevronLeft,
  ArrowUpRight, ArrowDownRight, Minus, Circle,
  Briefcase, ChefHat, Megaphone, Headphones, Users2,
  Star, TrendingUp, AlertCircle, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMarkdown } from "@/components/chat-markdown";
import { cn } from "@/lib/utils";

// ─── Agent Config ─────────────────────────────────────────────────────────────

type AgentId = "operation" | "chef" | "social" | "customer";

const AGENTS: Record<AgentId, {
  name: string;
  role: string;
  icon: React.ElementType;
  avatar: string;
  ring: string;
  badge: string;
}> = {
  operation: {
    name: "Operation Agent",
    role: "Business Operations",
    icon: Briefcase,
    avatar: "bg-blue-600",
    ring: "ring-blue-200",
    badge: "bg-blue-100 text-blue-700",
  },
  chef: {
    name: "Chef Agent",
    role: "Menu & Upsell",
    icon: ChefHat,
    avatar: "bg-amber-500",
    ring: "ring-amber-200",
    badge: "bg-amber-100 text-amber-700",
  },
  social: {
    name: "Social Media Agent",
    role: "Content & Creators",
    icon: Megaphone,
    avatar: "bg-purple-600",
    ring: "ring-purple-200",
    badge: "bg-purple-100 text-purple-700",
  },
  customer: {
    name: "Customer Service Agent",
    role: "Reviews & Retention",
    icon: Headphones,
    avatar: "bg-teal-600",
    ring: "ring-teal-200",
    badge: "bg-teal-100 text-teal-700",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockType =
  | "kpi-grid"
  | "budget-alert"
  | "weekly-chart"
  | "delivery-channels"
  | "approvals"
  | "recommendations"
  | "month-changes"
  | "chef-briefing"
  | "social-briefing"
  | "customer-briefing";

interface ChatMsg {
  id: string;
  role: "ai" | "user";
  agentId?: AgentId;
  text: string;
  blocks?: BlockType[];
  ts: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const kpiData = [
  { label: "Total Orders", value: "1,284", delta: "+12.4%", up: true, sub: "This month" },
  { label: "Online Revenue", value: "$28,460", delta: "+8.7%", up: true, sub: "This month" },
  { label: "Avg Order Value", value: "$22.17", delta: "+3.2%", up: true, sub: "vs last month" },
  { label: "Repeat Customer Rate", value: "31%", delta: "+2.1pp", up: true, sub: "vs last month" },
  { label: "Review Rating", value: "4.6 ★", delta: "Stable", up: null, sub: "48 new reviews" },
  { label: "Delivery Budget", value: "$1,300", delta: "Exceeds efficient cap", up: false, sub: "Recommend $700" },
];

const weeklyChart = [
  { week: "Week 1", spend: 520, orders: 68, revenue: 1420 },
  { week: "Week 2", spend: 610, orders: 79, revenue: 1760 },
  { week: "Week 3", spend: 590, orders: 82, revenue: 1890 },
  { week: "Week 4", spend: 680, orders: 91, revenue: 2030 },
];

const monthChanges = [
  { label: "Orders", prev: "1,143", curr: "1,284", delta: "+12.4%", up: true },
  { label: "Revenue", prev: "$26,180", curr: "$28,460", delta: "+8.7%", up: true },
  { label: "Avg Order Value", prev: "$21.49", curr: "$22.17", delta: "+3.2%", up: true },
  { label: "Repeat Customers", prev: "28.9%", curr: "31.0%", delta: "+2.1pp", up: true },
  { label: "Review Rating", prev: "4.5", curr: "4.6", delta: "+0.1", up: true },
  { label: "DoorDash Orders", prev: "589", curr: "545", delta: "−7.5%", up: false },
];

const channelData = [
  {
    name: "Uber Eats",
    dot: "bg-green-500",
    fields: [
      ["Spend", "$1,420"], ["Store Visits", "2,840"], ["Orders", "739"],
      ["Conversion", "6.9%"], ["Revenue", "$17,240"], ["Trend", "+11.2%"],
    ] as [string, string][],
  },
  {
    name: "DoorDash",
    dot: "bg-red-500",
    fields: [
      ["Spend", "$980"], ["Store Visits", "2,060"], ["Orders", "545"],
      ["Conversion", "6.0%"], ["Revenue", "$11,220"], ["Trend", "−7.5%"],
    ] as [string, string][],
  },
];

const approvalItems = [
  { id: 1, title: "3 short-form video drafts ready for review", category: "Content", detail: "Clip 03 · Clip 04 · Clip 05 — AI-generated for Instagram + TikTok" },
  { id: 2, title: "Creator shortlist for local collaboration", category: "Creators", detail: "5 candidates in Downtown area, food niche, 10k–80k followers" },
];

const recommendations = [
  { id: 1, label: "Reduce delivery budget cap to $700", reason: "$1,300 cap wastes spend on low-conversion afternoon hours", cta: "Apply", priority: "High" },
  { id: 2, label: "Expand combo-based promotions", reason: "Avg order value up 3.2% — combos are the driver", cta: "Review", priority: "Medium" },
  { id: 3, label: "Add beverage upsell to Instagram Stories", reason: "Milk Tea attach rate improving — reinforce with social content", cta: "Review", priority: "Medium" },
  { id: 4, label: "Reactivation campaign for 398 lapsed customers", reason: "Customers inactive 45+ days — lunch offer recommended", cta: "Approve", priority: "Low" },
];

const menuItems = [
  { name: "Kung Pao Chicken", orders: 284, trend: "+14%", revenue: "$3,834", img: "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=100&q=80" },
  { name: "Fried Rice Combo", orders: 231, trend: "+9%", revenue: "$3,696", img: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=100&q=80" },
  { name: "Spring Roll Set", orders: 176, trend: "+6%", revenue: "$1,584", img: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=100&q=80" },
];

const underperformingItems = [
  { name: "Hot & Sour Soup", orders: 84, trend: "−12%", note: "Seasonal softness" },
  { name: "Steamed Fish Fillet", orders: 47, trend: "−18%", note: "Needs photo refresh" },
];

// ─── Block Components ─────────────────────────────────────────────────────────

function KpiGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
      {kpiData.map((k) => (
        <div key={k.label} className="bg-background border border-border rounded-xl p-3.5">
          <p className="text-sm text-muted-foreground mb-1">{k.label}</p>
          <p className="font-serif text-xl font-bold text-foreground">{k.value}</p>
          <div className="flex items-center gap-1 mt-1">
            {k.up === true && <ArrowUpRight className="w-3 h-3 text-green-600" />}
            {k.up === false && <ArrowDownRight className="w-3 h-3 text-red-500" />}
            {k.up === null && <Minus className="w-3 h-3 text-muted-foreground" />}
            <span className={cn("text-sm font-medium", k.up === true ? "text-green-600" : k.up === false ? "text-red-500" : "text-muted-foreground")}>
              {k.delta}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{k.sub}</p>
        </div>
      ))}
    </div>
  );
}

function BudgetAlert() {
  const [applied, setApplied] = useState(false);
  return (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-sm font-semibold text-amber-700">Delivery Budget Alert</span>
      </div>
      <p className="text-sm text-foreground/80 mb-3">
        Current cap is <strong>$1,300</strong>. Afternoon hours (2:30–5 PM) are spending with low conversion. Reducing to <strong>$700</strong> eliminates waste while preserving 94% of peak-hour order volume.
      </p>
      <div className="flex gap-2">
        {applied ? (
          <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Budget cap updated to $700
          </span>
        ) : (
          <>
            <Button size="sm" onClick={() => setApplied(true)} className="bg-amber-600 hover:bg-amber-700 text-white border-0" data-testid="button-apply-budget">
              Use Recommended ($700)
            </Button>
            <Button size="sm" variant="outline" data-testid="button-budget-why">Why this?</Button>
          </>
        )}
      </div>
    </div>
  );
}

function WeeklyChart() {
  return (
    <div className="mt-3 bg-background border border-border rounded-xl p-4">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">4-Week Trend</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={weeklyChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(21,55%,50%)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(21,55%,50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="week" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Area type="monotone" dataKey="spend" stroke="hsl(21,55%,50%)" fill="url(#gS)" strokeWidth={2} name="Spend ($)" />
          <Area type="monotone" dataKey="orders" stroke="hsl(128,15%,59%)" fill="none" strokeWidth={2} name="Orders" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthChanges() {
  return (
    <div className="mt-3 bg-background border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5 border-b border-border bg-muted/40">
        <span className="col-span-2">Metric</span><span>Last Month</span><span>This Month</span>
      </div>
      {monthChanges.map((r) => (
        <div key={r.label} className="grid grid-cols-4 items-center px-4 py-3 border-b border-border last:border-0">
          <span className="col-span-2 text-sm text-foreground">{r.label}</span>
          <span className="text-sm text-muted-foreground">{r.prev}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{r.curr}</span>
            <span className={cn("text-sm font-medium", r.up ? "text-green-600" : "text-red-500")}>{r.delta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DeliveryChannels() {
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {channelData.map((ch) => (
        <div key={ch.name} className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <div className={cn("w-2.5 h-2.5 rounded-full", ch.dot)} />
            <span className="text-sm font-semibold text-foreground">{ch.name}</span>
          </div>
          <ul className="divide-y divide-border">
            {ch.fields.map(([l, v]) => (
              <li key={l} className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">{l}</span>
                <span className={cn("text-sm font-semibold",
                  l === "Trend" && v.startsWith("+") ? "text-green-600" :
                  l === "Trend" && v.startsWith("−") ? "text-red-500" : "text-foreground"
                )}>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Approvals() {
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [approved, setApproved] = useState<number[]>([]);
  return (
    <div className="mt-3 space-y-3">
      {approvalItems.map((item) => {
        if (dismissed.includes(item.id)) return null;
        const isApproved = approved.includes(item.id);
        return (
          <div key={item.id} className="bg-background border border-border rounded-xl p-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{item.category}</p>
            <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
            <p className="text-sm text-muted-foreground mb-3">{item.detail}</p>
            {isApproved ? (
              <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Approved</span>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setApproved((p) => [...p, item.id])} data-testid={`button-approve-${item.id}`}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => setDismissed((p) => [...p, item.id])} data-testid={`button-dismiss-${item.id}`}>Dismiss</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Recommendations() {
  const priorityColor: Record<string, string> = {
    High: "bg-red-100 text-red-700", Medium: "bg-amber-100 text-amber-700", Low: "bg-blue-100 text-blue-700",
  };
  return (
    <div className="mt-3 space-y-2">
      {recommendations.map((r) => (
        <div key={r.id} className="bg-background border border-border rounded-xl p-4 flex items-start gap-3">
          <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{r.label}</p>
              <span className={cn("text-sm font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide", priorityColor[r.priority])}>{r.priority}</span>
            </div>
            <p className="text-sm text-muted-foreground">{r.reason}</p>
          </div>
          <Button size="sm" variant="outline" className="flex-shrink-0 text-sm">{r.cta}</Button>
        </div>
      ))}
    </div>
  );
}

function ChefBriefing() {
  return (
    <div className="mt-3 space-y-3">
      {/* Top dishes */}
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-amber-50">
          <p className="text-sm font-semibold text-amber-700 uppercase tracking-wider">Top Performing Dishes</p>
        </div>
        <div className="divide-y divide-border">
          {menuItems.map((item) => (
            <div key={item.name} className="flex items-center gap-3 px-4 py-3">
              <img src={item.img} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.orders} orders · {item.revenue}</p>
              </div>
              <span className="text-sm font-semibold text-green-600 flex-shrink-0">{item.trend}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Underperforming */}
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-red-50">
          <p className="text-sm font-semibold text-red-700 uppercase tracking-wider">Needs Attention</p>
        </div>
        {underperformingItems.map((item) => (
          <div key={item.name} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.note}</p>
            </div>
            <span className="text-sm font-semibold text-red-500">{item.trend}</span>
          </div>
        ))}
      </div>

      {/* Combo opportunity */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">Combo Opportunity</span>
        </div>
        <p className="text-sm text-foreground/80 mb-2">
          <strong>"Wok & Roll" bundle</strong>: Kung Pao Chicken + Fried Rice + Spring Rolls for $28.50 (saves $4.50). Projected 180–220 orders/month. Milk Tea add-on attach rate is 18% vs 32% benchmark — I'll add an upsell prompt to both platforms.
        </p>
        <Button size="sm" variant="outline" className="text-amber-700 border-amber-300">Review Bundle</Button>
      </div>
    </div>
  );
}

function SocialBriefing() {
  return (
    <div className="mt-3 space-y-3">
      {/* Social metrics */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { platform: "Instagram", metric: "14,200", label: "Reach", trend: "+22%", color: "bg-pink-50 border-pink-100" },
          { platform: "TikTok", metric: "8,600", label: "Views", trend: "+38%", color: "bg-purple-50 border-purple-100" },
          { platform: "Google", metric: "2,140", label: "Profile views", trend: "+11%", color: "bg-blue-50 border-blue-100" },
        ].map((s) => (
          <div key={s.platform} className={cn("border rounded-xl p-3", s.color)}>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">{s.platform}</p>
            <p className="text-lg font-bold text-foreground font-serif">{s.metric}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="text-sm font-semibold text-green-600 mt-0.5">{s.trend}</p>
          </div>
        ))}
      </div>

      {/* Best performing content */}
      <div className="bg-background border border-border rounded-xl p-4 flex items-start gap-3">
        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center flex-shrink-0">
          <ImageIcon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-1">Best This Week</p>
          <p className="text-sm font-semibold text-foreground">Kung Pao Chicken Sizzle Reel</p>
          <p className="text-sm text-muted-foreground mt-0.5">4,200 views · 312 saves · 89 profile visits → 6 orders</p>
          <p className="text-sm text-green-700 font-medium mt-1">Top performer — recommend boosting with $80 paid promotion</p>
        </div>
      </div>

      {/* Content pipeline */}
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Content Pipeline</p>
        </div>
        {[
          { type: "Video", title: "Behind-the-scenes kitchen (TikTok)", status: "Ready for approval", statusColor: "text-amber-600" },
          { type: "Video", title: "Customer reaction compilation (Reels)", status: "Ready for approval", statusColor: "text-amber-600" },
          { type: "Creator", title: "5 micro-creator proposals (Downtown)", status: "Awaiting review", statusColor: "text-blue-600" },
        ].map((c, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-0.5">{c.type}</p>
              <p className="text-sm text-foreground">{c.title}</p>
            </div>
            <span className={cn("text-sm font-semibold flex-shrink-0 ml-3", c.statusColor)}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerBriefing() {
  return (
    <div className="mt-3 space-y-3">
      {/* Rating summary */}
      <div className="bg-background border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Overall Rating</p>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl font-bold text-foreground">4.6</span>
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <span className="text-sm text-muted-foreground">48 reviews this month</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-green-600">+0.1 vs last month</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[["Positive", "41", "text-green-600"], ["Neutral", "5", "text-muted-foreground"], ["Negative", "2", "text-red-500"]].map(([label, count, color]) => (
            <div key={label} className="text-center">
              <p className={cn("text-lg font-bold", color)}>{count}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback themes */}
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Key Feedback Themes</p>
        </div>
        {[
          { theme: "Delivery wait time", sentiment: "negative", count: 2, action: "Escalated to DoorDash support" },
          { theme: "Food quality & freshness", sentiment: "positive", count: 18, action: "Highlighted in review responses" },
          { theme: "Packaging quality", sentiment: "positive", count: 11, action: "Mentioned in thank-you replies" },
          { theme: "Portion size", sentiment: "neutral", count: 4, action: "Monitoring for trend" },
        ].map((f, i) => (
          <div key={i} className="flex items-start justify-between px-4 py-3 border-b border-border last:border-0 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{f.theme}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{f.action}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={cn("text-sm font-semibold", f.sentiment === "positive" ? "text-green-600" : f.sentiment === "negative" ? "text-red-500" : "text-muted-foreground")}>
                {f.count} mentions
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Retention signal */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-3.5 h-3.5 text-teal-700" />
          <span className="text-sm font-semibold text-teal-700">Retention Signal</span>
        </div>
        <p className="text-sm text-foreground/80 mb-2">
          <strong>398 customers</strong> haven't ordered in 45+ days. 142 are high-value (avg order &gt;$25). A targeted reactivation campaign could recover an estimated <strong>$3,100</strong> in orders.
        </p>
        <Button size="sm" variant="outline" className="text-teal-700 border-teal-300">Launch Reactivation</Button>
      </div>
    </div>
  );
}

function Block({ type }: { type: BlockType }) {
  switch (type) {
    case "kpi-grid": return <KpiGrid />;
    case "budget-alert": return <BudgetAlert />;
    case "weekly-chart": return <WeeklyChart />;
    case "delivery-channels": return <DeliveryChannels />;
    case "approvals": return <Approvals />;
    case "recommendations": return <Recommendations />;
    case "month-changes": return <MonthChanges />;
    case "chef-briefing": return <ChefBriefing />;
    case "social-briefing": return <SocialBriefing />;
    case "customer-briefing": return <CustomerBriefing />;
    default: return null;
  }
}

// ─── Context Panel ─────────────────────────────────────────────────────────────

function ContextPanel({ restaurantName }: { restaurantName: string }) {
  return (
    <div className="w-60 xl:w-64 flex-shrink-0 border-l border-border bg-card overflow-y-auto hidden lg:flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Active Account</p>
        <p className="text-sm font-bold text-foreground">{restaurantName || "—"}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-sm text-green-700 font-medium">Growth Retainer · Active</span>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2.5">Active Agents</p>
        <div className="space-y-2.5">
          {(Object.entries(AGENTS) as [AgentId, typeof AGENTS[AgentId]][]).map(([id, agent]) => (
            <div key={id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", agent.avatar)}>
                  <agent.icon className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm text-muted-foreground">{agent.role}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-sm text-green-700 font-medium">Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2.5">This Month</p>
        <div className="space-y-2">
          {[["Orders", "1,284"], ["Revenue", "$28,460"], ["Avg Order", "$22.17"], ["Repeat Rate", "31%"], ["Rating", "4.6 ★"]].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{l}</span>
              <span className="text-sm font-semibold text-foreground">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Pending Approval</p>
          <span className="text-sm font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">2</span>
        </div>
        <div className="space-y-2">
          {["3 video drafts (Social Media Agent)", "Creator shortlist – 5 candidates"].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Circle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-foreground/80 leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Chip Tree ────────────────────────────────────────────────────────────────

interface LeafChip {
  label: string;
  response: string;
  agentId: AgentId;
  blocks?: BlockType[];
}

interface SubChip { label: string; children: LeafChip[]; }
interface TopChip { label: string; children: SubChip[]; }

const chipTree: TopChip[] = [
  {
    label: "Weekly summary",
    children: [
      { label: "Orders & Revenue", children: [
        { label: "Order count by day", agentId: "operation", response: "Wednesday and Friday lead with 90+ orders each. Monday is softest — flagging for a targeted lunch promotion next week." },
        { label: "Revenue breakdown", agentId: "operation", response: "Weekly online revenue: $7,320. Uber Eats 63%, DoorDash 37%. Avg ticket $22.17 — up from $21.80 last week.", blocks: ["weekly-chart"] },
        { label: "Peak hours", agentId: "operation", response: "Peak windows: 12–1:30 PM and 6–8 PM daily. Saturday evenings avg $1,100 in a single 2-hour window. I'm already concentrating ad spend here." },
      ]},
      { label: "Delivery Spend", children: [
        { label: "By channel", agentId: "operation", response: "Uber Eats $355, DoorDash $245 this week. Uber Eats generates $4.38 revenue per $1 spent vs DoorDash at $2.78.", blocks: ["delivery-channels"] },
        { label: "Cost per order", agentId: "operation", response: "Blended CPO: $3.07. Uber Eats $1.81, DoorDash $1.98. Both beat the $3.50 industry benchmark." },
        { label: "Budget remaining", agentId: "operation", response: "$100 of your $700 recommended weekly budget remains. I'll deploy it toward Saturday evening peak hours.", blocks: ["budget-alert"] },
      ]},
      { label: "Menu Performance", children: [
        { label: "Top dishes", agentId: "chef", response: "Kung Pao Chicken leads with 284 orders. Fried Rice Combo close behind at 231. Both are trending up double-digits.", blocks: ["chef-briefing"] },
        { label: "Upsell opportunities", agentId: "chef", response: "Milk Tea attach rate is 18% vs 32% benchmark. Adding a checkout prompt on both platforms could add ~$1,040/month at current volume." },
        { label: "Combo ideas", agentId: "chef", response: "The 'Wok & Roll' bundle (Kung Pao + Fried Rice + Spring Rolls, $28.50) is ready to test. Projected 180–220 orders/month.", blocks: ["chef-briefing"] },
      ]},
      { label: "Social & Content", children: [
        { label: "Content performance", agentId: "social", response: "Best this week: Kung Pao Chicken sizzle reel — 4,200 views, 312 saves, 89 profile visits. I recommend a $80 paid boost.", blocks: ["social-briefing"] },
        { label: "Pipeline status", agentId: "social", response: "2 video drafts and 1 creator shortlist are ready for your approval.", blocks: ["approvals"] },
        { label: "Reach & followers", agentId: "social", response: "Instagram reach: 14,200 (+22%). TikTok views: 8,600 (+38%). Trending up across all channels.", blocks: ["social-briefing"] },
      ]},
    ],
  },
  {
    label: "Delivery performance",
    children: [
      { label: "Uber Eats", children: [
        { label: "Spend & ROI", agentId: "operation", response: "$1,420 spend → $17,240 revenue → 3.1x ROAS. CPO $1.81 — top 20% for your category." },
        { label: "Order trends", agentId: "operation", response: "Uber Eats: Week 1 (68) → Week 2 (79) → Week 3 (82) → Week 4 (91). Consistent growth. Lunch window drives 41% of orders.", blocks: ["weekly-chart"] },
        { label: "Competitor standing", agentId: "operation", response: "Your conversion rate (6.9%) leads your delivery zone. Rating (4.8★ on Uber Eats) is the highest in category. CPO is 18% below average." },
      ]},
      { label: "DoorDash", children: [
        { label: "Spend & ROI", agentId: "operation", response: "$980 spend → $11,220 revenue → 2.8x ROAS. Below Uber Eats but still healthy. Monitoring the dip." },
        { label: "Why orders dipped", agentId: "operation", response: "Three causes: (1) DoorDash algorithm update penalized restaurants with delivery times over 30 min — yours averaged 31 min. (2) New competitor opened 0.4 miles away. (3) Fewer promo ad slots in your category." },
        { label: "Recovery plan", agentId: "operation", response: "Plan: (1) Reduce prep time by 2 min to go under 30-min avg. (2) Add high-quality photos to 3 menu items. (3) Test a DoorDash-exclusive $2 discount — ready to deploy with your approval." },
      ]},
      { label: "Budget Analysis", children: [
        { label: "Current cap vs efficient", agentId: "operation", response: "Cap: $1,300. 18% of spend (~$234/month) lands in low-conversion afternoon hours. Reducing to $700 removes waste while preserving peak-hour demand.", blocks: ["budget-alert"] },
        { label: "Recommended cap", agentId: "operation", response: "Optimal monthly cap: $700. At this level you capture 94% of high-intent demand. Above $700, marginal CPO rises sharply.", blocks: ["budget-alert"] },
        { label: "Hourly breakdown", agentId: "operation", response: "Best ROAS hours: 12 PM (4.8x), 1 PM (5.1x), 6:30 PM (4.6x), 7 PM (4.9x). Worst: 2:30 PM (1.4x), 3:30 PM (1.2x). I've already adjusted bids accordingly." },
      ]},
      { label: "Channel Comparison", children: [
        { label: "Revenue split", agentId: "operation", response: "Uber Eats: $17,240 (60.6%). DoorDash: $11,220 (39.4%). The shift toward Uber Eats is intentional based on ROAS.", blocks: ["delivery-channels"] },
        { label: "CPA comparison", agentId: "operation", response: "CPA: Uber Eats $7.24 vs DoorDash $8.04. Both beat the $9.50 benchmark. Current 59/41 spend split is optimal." },
        { label: "AI recommendations", agentId: "operation", response: "Top 3: (1) Reduce cap to $700. (2) Shift 5% more spend to Uber Eats lunch. (3) Test weekend dinner combo on Uber Eats.", blocks: ["recommendations"] },
      ]},
    ],
  },
  {
    label: "Menu & upsell",
    children: [
      { label: "Top dishes", children: [
        { label: "Best sellers", agentId: "chef", response: "Kung Pao Chicken (284 orders, +14%), Fried Rice Combo (231, +9%), Spring Roll Set (176, +6%). All three earn 'Popular' badges on Uber Eats.", blocks: ["chef-briefing"] },
        { label: "Revenue per dish", agentId: "chef", response: "Kung Pao Chicken revenue: $3,834/month. Fried Rice Combo: $3,696. Spring Roll Set: $1,584. Kung Pao + Combo together = 45% of total menu revenue." },
        { label: "Needs attention", agentId: "chef", response: "Hot & Sour Soup: −12% (seasonal). Steamed Fish Fillet: −18% (needs a photo refresh to improve click-through).", blocks: ["chef-briefing"] },
      ]},
      { label: "Bundle strategy", children: [
        { label: "Wok & Roll bundle", agentId: "chef", response: "'Wok & Roll': Kung Pao + Fried Rice + Spring Rolls for $28.50 (saves $4.50). Projected 180–220 orders/month. Available on both platforms. Awaiting your approval." },
        { label: "Seasonal specials", agentId: "chef", response: "Q3 suggestion: 'Summer Mango Chicken' (light, photogenic) and 'Spicy Szechuan Ramen' (high local search demand). Limited-time items average 34% higher social sharing." },
        { label: "Price elasticity", agentId: "chef", response: "Your customers are largely price-insensitive below 8% increases. Kung Pao Chicken showed no sensitivity to a $1.00 price increase. Hot & Sour Soup is more sensitive — hold pricing there." },
      ]},
      { label: "Upsell & add-ons", children: [
        { label: "Milk Tea opportunity", agentId: "chef", response: "Milk Tea attach rate: 18% vs 32% benchmark. Adding a checkout prompt ('Add Milk Tea for $4.50?') could add $0.81 to avg order value — that's ~$1,040/month." },
        { label: "Combo add-ons", agentId: "chef", response: "Customers who added a combo this month averaged $26.40 vs $22.17 baseline — 19% higher. Expanding combo visibility on delivery menus is the single fastest AOV lever." },
        { label: "Cross-sell ideas", agentId: "chef", response: "Top cross-sell pair: Kung Pao Chicken + Hot Tea (42% co-order rate). Spring Roll Set + Dipping Sauce upgrade (31%). I'll add 'Frequently ordered together' prompts on both platforms." },
      ]},
      { label: "Photo & menu refresh", children: [
        { label: "What needs photos", agentId: "chef", response: "Steamed Fish Fillet has no updated photo — orders dropped 18%. A professional food photo typically lifts click-through by 25–40%. This is the highest-ROI fix on the menu." },
        { label: "Menu copy review", agentId: "chef", response: "3 items have descriptions under 15 words — below the Uber Eats recommendation of 20+. Short descriptions reduce click-through. I've drafted improved copy for your review." },
        { label: "Seasonal menu update", agentId: "chef", response: "Recommend rotating 2 seasonal items for Q3. I've identified the top 5 candidates based on ingredient cost, local search trends, and competitor gaps in your delivery zone." },
      ]},
    ],
  },
  {
    label: "Social & content",
    children: [
      { label: "Content performance", children: [
        { label: "Best performing post", agentId: "social", response: "Kung Pao Chicken sizzle reel: 4,200 views, 312 saves, 89 profile visits, 6 attributed orders. This is your top-performing asset — I recommend a $80 paid boost.", blocks: ["social-briefing"] },
        { label: "Reach this month", agentId: "social", response: "Instagram: 14,200 reach (+22%), TikTok: 8,600 views (+38%), Google Business: 2,140 profile views (+11%). All channels trending up." },
        { label: "Engagement rate", agentId: "social", response: "Instagram engagement rate: 3.2%. Industry benchmark for food: 4.5%. Opportunity: increase posting frequency from 2x to 4x/week + 3 targeted hashtags. Projected +40% reach in 60 days." },
      ]},
      { label: "Content pipeline", children: [
        { label: "Ready to approve", agentId: "social", response: "2 video drafts and 1 creator shortlist are awaiting your approval. I've paused scheduling until you review.", blocks: ["approvals"] },
        { label: "Next week's plan", agentId: "social", response: "Next week: Monday poll ('Rice or Noodles?'), Wednesday lunch promo Story, Friday flash deal, weekend combo reveal Reel. All scripted and templated." },
        { label: "90-day calendar", agentId: "social", response: "Q3 content calendar: June — summer heat wave theme, iced beverages. July — combo focus + creator launch. August — Back-to-school family meal deals. I can generate the full calendar for your review." },
      ]},
      { label: "Creator collaborations", children: [
        { label: "Shortlist status", agentId: "social", response: "5 micro-creators shortlisted: @downtownfoodiejen (42k, $220/post), @eatlocalmike (28k, $180/post), @citybitesblog (71k, $310/post), @tastetheblock (19k, $150/post), @lunchhourfoodie (33k, $200/post).", blocks: ["approvals"] },
        { label: "Past campaign results", agentId: "social", response: "Last creator campaign: 22,400 combined reach, 67 tracked orders via promo code, 3.8x ROI. Creator CAC ($6.40) beats Uber Eats ads ($7.24) for new customer acquisition." },
        { label: "Q3 creator plan", agentId: "social", response: "Recommend 1 creator campaign/month at $400–600 spend. Projected $1,520–$2,280 attributable revenue per campaign based on past results. Budget approval needed." },
      ]},
      { label: "Brand & visibility", children: [
        { label: "Google Business", agentId: "social", response: "Google Business this month: 2,140 profile views, 84 direction requests, 38 calls. I added 4 new photos and updated your hours — visibility is improving." },
        { label: "Instagram growth", agentId: "social", response: "Followers: 1,840 (+312 from TikTok referrals). Profile visits from Reels: 890. Link clicks: 142. Recommend adding an ordering link to bio." },
        { label: "Visibility score", agentId: "social", response: "Cross-channel visibility score (my composite metric): 74/100 this month vs 68/100 last month. Largest gains: TikTok +12 points, Google +4 points. Instagram still has room to grow." },
      ]},
    ],
  },
  {
    label: "Reviews & customers",
    children: [
      { label: "Review summary", children: [
        { label: "Rating trend", agentId: "customer", response: "Rating: 4.6★ this month vs 4.5★ last month. 48 new reviews: 41 positive, 5 neutral, 2 negative. Trajectory is positive.", blocks: ["customer-briefing"] },
        { label: "Platform breakdown", agentId: "customer", response: "Google: 4.7★ (28 new reviews). Uber Eats: 4.8★ (12 new). DoorDash: 4.3★ (8 new — lowest due to delivery time complaints). I've escalated DoorDash timing to their support team." },
        { label: "Negative reviews", agentId: "customer", response: "2 negative reviews this month, both flagging delivery wait time. I responded within 2 hours with an apology + recovery offer (10% off next order). Both reviewers have been re-contacted." },
      ]},
      { label: "Feedback themes", children: [
        { label: "Top complaints", agentId: "customer", response: "Complaint themes: delivery wait time (2 reviews, DoorDash only), packaging leak (1 mention — soups). I've flagged both to operations and DoorDash support.", blocks: ["customer-briefing"] },
        { label: "Top praise", agentId: "customer", response: "Top praise: food quality (18 mentions), portion size (11), friendliness (8), packaging presentation (7). Highlight these in your marketing copy — they're your actual differentiators." },
        { label: "Emerging trends", agentId: "customer", response: "New trend: 4 reviews mentioned Milk Tea positively — this is driving your beverage revenue spike. I'll surface this to the Chef Agent for menu emphasis." },
      ]},
      { label: "Retention & loyalty", children: [
        { label: "Repeat customer rate", agentId: "customer", response: "Repeat rate: 31% this month vs 28.9% last month. The post-order SMS sequence is the primary driver — customers who received it returned at 37% vs 24% without it." },
        { label: "Lapsed customers", agentId: "customer", response: "398 customers inactive 45+ days. Segmented: 142 high-value (avg order >$25), 189 mid-value, 67 low-value. A targeted lunch reactivation campaign could recover ~$3,100.", blocks: ["customer-briefing"] },
        { label: "Loyalty program options", agentId: "customer", response: "'Every 10th order free' mechanic could increase repeat frequency by ~14%. Runs via SMS tracking — no extra software. I can configure and launch with your approval." },
      ]},
      { label: "Response & recovery", children: [
        { label: "Review response rate", agentId: "customer", response: "I responded to 11 of 11 new reviews this month — 100% response rate. Average response time: 2.1 hours. Industry benchmark: 48 hours. You're leading your category here." },
        { label: "Recovery campaigns", agentId: "customer", response: "Recovery campaign sent to 2 negative reviewers: 10% off next order. One has re-ordered (recovered). One is still pending. I'll follow up in 5 days." },
        { label: "Proactive reputation", agentId: "customer", response: "Proactive ask: adding a post-delivery QR code prompt to ask for a Google review from satisfied customers. Similar restaurants using this see 2.3x more review volume. Want to test it?" },
      ]},
    ],
  },
];

type ChipLevel = "top" | "sub" | "subsub";
interface ChipNav { level: ChipLevel; topIdx: number | null; subIdx: number | null; }

function ChipBar({ nav, setNav, onSend }: {
  nav: ChipNav;
  setNav: (n: ChipNav) => void;
  onSend: (label: string, agentId: AgentId, response: string, blocks?: BlockType[]) => void;
}) {
  if (nav.level === "top") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {chipTree.map((chip, i) => (
          <button key={chip.label} onClick={() => setNav({ level: "sub", topIdx: i, subIdx: null })}
            className="text-[13px] font-medium px-3 py-1.5 rounded-full border border-border/40 bg-transparent text-muted-foreground/70 hover:text-foreground hover:border-border/70 transition-colors leading-none"
            data-testid={`chip-top-${i}`}>{chip.label}
          </button>
        ))}
      </div>
    );
  }
  if (nav.level === "sub" && nav.topIdx !== null) {
    const parent = chipTree[nav.topIdx];
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        <button onClick={() => setNav({ level: "top", topIdx: null, subIdx: null })}
          className="flex items-center gap-1 text-[13px] font-medium px-2.5 py-1.5 rounded-full border border-border/40 bg-transparent text-muted-foreground/70 hover:text-foreground hover:border-border/70 transition-colors leading-none" data-testid="chip-back-sub">
          <ChevronLeft className="w-3 h-3" /> Back
        </button>
        <span className="text-[13px] text-muted-foreground/50 px-1">{parent.label} →</span>
        {parent.children.map((sub, i) => (
          <button key={sub.label} onClick={() => setNav({ level: "subsub", topIdx: nav.topIdx, subIdx: i })}
            className="text-[13px] font-medium px-3 py-1.5 rounded-full border border-border/40 bg-transparent text-muted-foreground/70 hover:text-foreground hover:border-border/70 transition-colors leading-none" data-testid={`chip-sub-${i}`}>
            {sub.label}
          </button>
        ))}
      </div>
    );
  }
  if (nav.level === "subsub" && nav.topIdx !== null && nav.subIdx !== null) {
    const sub = chipTree[nav.topIdx].children[nav.subIdx];
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        <button onClick={() => setNav({ ...nav, level: "sub", subIdx: null })}
          className="flex items-center gap-1 text-[13px] font-medium px-2.5 py-1.5 rounded-full border border-border/40 bg-transparent text-muted-foreground/70 hover:text-foreground hover:border-border/70 transition-colors leading-none" data-testid="chip-back-subsub">
          <ChevronLeft className="w-3 h-3" /> Back
        </button>
        <span className="text-[13px] text-muted-foreground/50 px-1">{sub.label} →</span>
        {sub.children.map((leaf, i) => (
          <button key={leaf.label} onClick={() => {
            onSend(leaf.label, leaf.agentId, leaf.response, leaf.blocks);
            setNav({ level: "top", topIdx: null, subIdx: null });
          }}
            className="text-[13px] font-medium px-3 py-1.5 rounded-full border border-border/40 bg-transparent text-muted-foreground/70 hover:text-foreground hover:border-border/70 transition-colors leading-none" data-testid={`chip-leaf-${i}`}>
            {leaf.label}
          </button>
        ))}
      </div>
    );
  }
  return null;
}

// ─── Agent Avatar ─────────────────────────────────────────────────────────────

function AgentAvatar({ agentId }: { agentId: AgentId }) {
  const agent = AGENTS[agentId];
  return (
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", agent.avatar)}>
      <agent.icon className="w-4 h-4 text-white" />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2); }
function nowStr() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

// ─── Initial boardroom messages ────────────────────────────────────────────────

function makeInitialMessages(restaurantName: string): ChatMsg[] { return [
  {
    id: "op-welcome", role: "ai", agentId: "operation", ts: "09:00",
    text: `Good afternoon. Here's your daily business briefing for ${restaurantName}. Orders are up 12.4% this month, repeat customer rate is climbing to 31%, and Uber Eats is significantly outperforming DoorDash. Your delivery budget cap of $1,300 is generating wasted spend in afternoon hours — I recommend reducing it to $700.`,
    blocks: ["kpi-grid", "budget-alert"],
  },
  {
    id: "chef-welcome", role: "ai", agentId: "chef", ts: "09:01",
    text: "Menu update from the kitchen side. Kung Pao Chicken is your clear anchor — 284 orders and trending up 14%. I've spotted a combo gap and a Milk Tea upsell opportunity worth exploring. Two items need attention: Hot & Sour Soup is down seasonally, and Steamed Fish Fillet needs a photo refresh.",
    blocks: ["chef-briefing"],
  },
  {
    id: "social-welcome", role: "ai", agentId: "social", ts: "09:02",
    text: "Content report: your Kung Pao Chicken sizzle reel from Tuesday is your top-performing asset — 4,200 views with strong save and profile-visit rates. I have 2 video drafts and a creator shortlist ready for your approval. Instagram reach grew 22% this month; TikTok is up 38%.",
    blocks: ["social-briefing"],
  },
  {
    id: "cust-welcome", role: "ai", agentId: "customer", ts: "09:03",
    text: "Customer pulse for the month: sentiment is largely positive with your rating holding at 4.6★ across 48 new reviews. Two negatives flagged delivery wait time — I've already responded and escalated to DoorDash support. One retention signal you should act on: 398 customers haven't returned in 45+ days.",
    blocks: ["customer-briefing"],
  },
]; }

// ─── Boardroom Header ─────────────────────────────────────────────────────────

function BoardroomHeader({ restaurantName }: { restaurantName: string }) {
  return (
    <div className="flex-shrink-0 px-5 py-3 border-b border-border bg-card flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Users2 className="w-4 h-4 text-primary" />
        <span className="font-serif text-base font-bold text-foreground">Boardroom</span>
        {restaurantName && <span className="text-sm text-muted-foreground">· {restaurantName}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        {(Object.entries(AGENTS) as [AgentId, typeof AGENTS[AgentId]][]).map(([id, agent]) => (
          <div key={id} title={agent.name}
            className={cn("w-6 h-6 rounded-full flex items-center justify-center ring-2", agent.avatar, agent.ring)}>
            <agent.icon className="w-3 h-3 text-white" />
          </div>
        ))}
        <span className="text-sm text-muted-foreground ml-1.5">4 agents active</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMsg[]>(() => makeInitialMessages(""));
  const [input, setInput] = useState("");
  const [chipNav, setChipNav] = useState<ChipNav>({ level: "top", topIdx: null, subIdx: null });
  const [isThinking, setIsThinking] = useState(() => {
    const flag = sessionStorage.getItem("fromLogin");
    if (flag) { sessionStorage.removeItem("fromLogin"); return true; }
    return false;
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: restaurantData, isLoading: restaurantsLoading } = useQuery<{ restaurants: Restaurant[] }>({
    queryKey: ["/api/restaurants"],
    enabled: !!user,
  });
  const hasRestaurants = (restaurantData?.restaurants?.length ?? 0) > 0;
  const showOnboarding = !restaurantsLoading && !hasRestaurants && !!user;
  const currentRestaurant = restaurantData?.restaurants?.find(r => r.id === user?.currentRestaurantId)
    ?? restaurantData?.restaurants?.[0];
  const restaurantName = currentRestaurant?.name ?? "";

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    try {
      const hired = JSON.parse(localStorage.getItem("favie_hired_agents") || "[]");
      if (Array.isArray(hired) && hired.length > 0) {
        navigate(`/admin/agents/${hired[hired.length - 1]}`);
      } else {
        navigate("/admin/task-market");
      }
    } catch {
      navigate("/admin/task-market");
    }
  }, [user]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (!isThinking) return;
    const t = setTimeout(() => setIsThinking(false), 2000);
    return () => clearTimeout(t);
  }, [isThinking]);
  useEffect(() => {
    if (restaurantName && messages.length === 4 && messages.every(m => m.role === "ai")) {
      setMessages(makeInitialMessages(restaurantName));
    }
  }, [restaurantName]);

  if (isThinking) return <ThinkingScreen />;

  const sendChipResponse = (label: string, agentId: AgentId, response: string, blocks?: BlockType[]) => {
    const userMsg: ChatMsg = { id: makeId(), role: "user", text: label, ts: nowStr() };
    const aiMsg: ChatMsg = { id: makeId(), role: "ai", agentId, text: response, blocks, ts: nowStr() };
    setMessages((m) => [...m, userMsg, aiMsg]);
    setInput("");
  };

  const sendFreeText = () => {
    if (!input.trim()) return;
    const userMsg: ChatMsg = { id: makeId(), role: "user", text: input, ts: nowStr() };
    const aiMsg: ChatMsg = { id: makeId(), role: "ai", agentId: "operation", text: "Got it — I'm coordinating with the team. In a live account this would pull real-time data across all four agents.", ts: nowStr() };
    setMessages((m) => [...m, userMsg, aiMsg]);
    setInput("");
  };

  if (!user) return null;

  if (showOnboarding) {
    return (
      <AdminLayout chatMode>
        <div className="flex flex-col flex-1 overflow-hidden h-full items-center justify-center">
          <div className="w-full max-w-md mx-auto px-6 py-12">
            <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
              <div className="mb-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Briefcase className="w-6 h-6 text-primary" />
                </div>
                <h2 className="font-serif text-xl font-bold text-foreground">Welcome to Favie</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Let's set up your first restaurant so your AI agents can get to work.
                </p>
              </div>
              <RestaurantSetupFlow
                onComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
                  navigate("/admin/agents/expert");
                }}
              />
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout chatMode>
      <div className="flex flex-col flex-1 overflow-hidden h-full">
        <BoardroomHeader restaurantName={restaurantName} />
        <div className="flex flex-1 overflow-hidden">

          {/* ── Chat thread ──────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6" data-testid="chat-thread">
              {messages.map((msg) => (
                <div key={msg.id}
                  className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse max-w-lg ml-auto" : "max-w-3xl")}
                  data-testid={`msg-${msg.role}-${msg.id}`}>

                  {msg.role === "ai" && msg.agentId && <AgentAvatar agentId={msg.agentId} />}
                  {msg.role === "ai" && !msg.agentId && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className={cn("flex items-baseline gap-2 mb-1.5", msg.role === "user" && "flex-row-reverse")}>
                      {msg.role === "ai" && msg.agentId ? (
                        <>
                          <span className="text-sm font-semibold text-foreground">{AGENTS[msg.agentId].name}</span>
                          <span className={cn("text-sm font-medium px-1.5 py-0.5 rounded-full", AGENTS[msg.agentId].badge)}>
                            {AGENTS[msg.agentId].role}
                          </span>
                          <span className="text-sm text-muted-foreground">{msg.ts}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-foreground">{msg.role === "ai" ? "Favie AI" : "You"}</span>
                          <span className="text-sm text-muted-foreground">{msg.ts}</span>
                        </>
                      )}
                    </div>

                    <div className={cn("rounded-xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "ai" ? "bg-card border border-border text-foreground" : "bg-primary text-primary-foreground")}>
                      {msg.role === "ai" ? <ChatMarkdown text={msg.text} /> : msg.text}
                    </div>

                    {msg.blocks?.map((b) => <Block key={b} type={b} />)}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-border bg-card px-4 sm:px-6 pt-3 pb-4">
              <div className="mb-4">
                <ChipBar nav={chipNav} setNav={setChipNav} onSend={sendChipResponse} />
              </div>
              <div className="flex items-center gap-2.5">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  placeholder="Ask the team anything — delivery, menu, content, reviews…"
                  style={{ minHeight: "52px" }}
                  className="flex-1 text-sm px-4 py-3 rounded-xl border border-border/80 bg-muted/30 text-foreground placeholder:text-muted-foreground/75 outline-none ring-2 ring-primary/25 focus:ring-primary/40 focus:border-primary/50 transition-colors"
                  data-testid="input-chat" />
                <Button onClick={sendFreeText} disabled={!input.trim()}
                  style={{ minHeight: "52px" }}
                  className="flex-shrink-0 px-5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-sm active:scale-95 transition-transform"
                  data-testid="button-chat-send">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* ── Right context panel ─────────────────────────────────────── */}
          <ContextPanel restaurantName={restaurantName} />
        </div>
      </div>
    </AdminLayout>
  );
}
