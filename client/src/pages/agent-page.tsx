import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, CheckCircle2, ChevronRight,
  Briefcase, ChefHat, Megaphone, Headphones,
  TrendingUp, Star, RotateCcw, ShoppingBag, Zap,
  Truck, Utensils, Users2, Heart,
  BarChart2, CalendarDays, Camera, FileText,
  Eye, Bookmark, Share2, AlertCircle, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/not-found";

// ─── Types ─────────────────────────────────────────────────────────────────────
type IconComponent = React.ElementType;
interface CapabilityGroup { icon: IconComponent; title: string; tags: string[] }
interface Expectation { icon: IconComponent; title: string; desc: string }
interface ExampleOutput { label: string; text: string }
interface Outcome { metric: string; label: string; sub: string }

// ─── Agent Config ──────────────────────────────────────────────────────────────
const AGENT_CONFIG = {
  operation: {
    id: "operation",
    name: "Operation Agent",
    tagline: "Business Growth & Delivery Intelligence",
    role: "Your AI growth manager for delivery platforms",
    icon: Briefcase,
    color: "bg-blue-600",
    lightBg: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    heroAccentColor: "text-blue-400",
    heroImg: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80",
    heroAlt: "Busy restaurant kitchen in full operation",
    contextImages: [
      { src: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80", alt: "Restaurant food ready for delivery", caption: "Delivery performance, tracked daily" },
      { src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80", alt: "Business analytics dashboard", caption: "Revenue and ROAS, always visible" },
      { src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80", alt: "Restaurant dining room", caption: "Growth that compounds over time" },
    ],
    intro: "Monitor delivery performance, eliminate ad waste, and surface the right promotions — running 24/7 so you never miss a revenue opportunity.",
    outcomes: [
      { metric: "+18%", label: "Order volume", sub: "Within 90 days" },
      { metric: "3.1x", label: "Delivery ROAS", sub: "Avg. return on ad spend" },
      { metric: "-22%", label: "Ad waste", sub: "By eliminating slow windows" },
    ] as Outcome[],
    capabilityGroups: [
      { icon: TrendingUp, title: "Growth Monitoring", tags: ["Order volume trends", "Revenue tracking", "Platform traffic analysis", "Growth risk alerts"] },
      { icon: Truck, title: "Delivery Optimization", tags: ["Ad bid management", "Peak-hour coverage", "Storefront conversion", "Waste window detection"] },
      { icon: BarChart2, title: "Budget Strategy", tags: ["Spend-to-return analysis", "Monthly cap recommendations", "Budget reallocation", "ROI reporting"] },
      { icon: Zap, title: "Promotion Planning", tags: ["BOGO and discount tracking", "Combo offers", "Promotion mix strategy", "Incremental order attribution"] },
    ] as CapabilityGroup[],
    expectations: [
      { icon: BarChart2, title: "Weekly Order Summary", desc: "Orders, revenue, and trend direction every week" },
      { icon: TrendingUp, title: "Platform Comparison", desc: "Uber Eats vs DoorDash side-by-side performance" },
      { icon: DollarSign, title: "Budget Recommendations", desc: "Cap adjustments based on current spend efficiency" },
      { icon: Zap, title: "Promotion Performance", desc: "Results across all active offers and campaigns" },
      { icon: AlertCircle, title: "Spend Alerts", desc: "Early warnings on waste and underperforming campaigns" },
      { icon: CheckCircle2, title: "Weekly Priorities", desc: "Top 3 growth actions your restaurant should take next" },
    ] as Expectation[],
    exampleOutputs: [
      { label: "Budget alert", text: "Detected 18% ad waste in the 2:30–5 PM delivery window. Recommend reducing daily cap from $1,300 to $700 — saves ~$600/month with no impact on peak-hour coverage." },
      { label: "Platform report", text: "DoorDash ROAS this week: 3.1x. Uber Eats: 2.4x. Recommend shifting 20% of Uber Eats budget to DoorDash for the next 14 days." },
      { label: "Promotion insight", text: "Combo A (Spring Roll + Fried Rice) is generating 24% higher AOV. Recommend featuring it in your DoorDash storefront banner this weekend." },
    ] as ExampleOutput[],
  },

  chef: {
    id: "chef",
    name: "Chef Agent",
    tagline: "Menu Innovation & Item Optimization",
    role: "Your AI menu strategist and content optimizer",
    icon: ChefHat,
    color: "bg-amber-500",
    lightBg: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    heroAccentColor: "text-amber-400",
    heroImg: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80",
    heroAlt: "Beautifully plated restaurant food",
    contextImages: [
      { src: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80", alt: "Chef cooking", caption: "Dish ideas grounded in real demand" },
      { src: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80", alt: "Food photography spread", caption: "Menu photography, audited and improved" },
      { src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80", alt: "Restaurant ambiance", caption: "Presentation that drives more orders" },
    ],
    intro: "Research food trends, audit item performance, and continuously improve how your menu looks, reads, and converts — without the guesswork.",
    outcomes: [
      { metric: "+22%", label: "Avg. order value", sub: "From hero item promotion" },
      { metric: "+31%", label: "CTR on updated items", sub: "After photo improvement" },
      { metric: "4–6 wks", label: "Trend-to-menu speed", sub: "Faster than manual research" },
    ] as Outcome[],
    capabilityGroups: [
      { icon: ChefHat, title: "New Dish Ideas", tags: ["Trend-based suggestions", "Seasonal specials", "Menu gap identification", "LTO planning"] },
      { icon: Utensils, title: "Menu Improvement", tags: ["Hero dish recommendations", "Underperformer alerts", "Item refresh opportunities", "Cuisine alignment"] },
      { icon: Camera, title: "Photo Optimization", tags: ["Click-through rate audit", "Photo quality flags", "Visual presentation guidance", "Retake recommendations"] },
      { icon: FileText, title: "Description Upgrades", tags: ["Appetite-triggering rewrites", "Clarity improvements", "Before/after examples", "Approval-ready drafts"] },
    ] as CapabilityGroup[],
    expectations: [
      { icon: ChefHat, title: "Dish Recommendations", desc: "New ideas each cycle based on trend and demand data" },
      { icon: CalendarDays, title: "Seasonal Suggestions", desc: "Tied to upcoming events, weather, and food trends" },
      { icon: Camera, title: "Photo Priorities", desc: "Items that need visual upgrades with specific guidance" },
      { icon: FileText, title: "Description Rewrites", desc: "Before/after drafts ready for your approval" },
      { icon: Star, title: "Hero Item Picks", desc: "What to feature in storefronts and promotions" },
      { icon: AlertCircle, title: "Underperformer Alerts", desc: "Items flagged by low click-through and order data" },
    ] as Expectation[],
    exampleOutputs: [
      { label: "Trend alert", text: "Mango Chicken Bowl is trending heavily on TikTok — 240K+ posts in the last 7 days. Recommend adding a seasonal variant using your existing Hainanese Chicken base." },
      { label: "Photo audit", text: "Steamed Fish Fillet has 18% below-average click-through. Photo shows a grey, poorly lit presentation. Recommend retaking with cleaner plating and warmer lighting." },
      { label: "Description rewrite", text: "Before: 'Kung Pao Chicken with peanuts.' After: 'Wok-fired chicken with roasted chillies, crunchy peanuts, and a bold Sichuan glaze — built for delivery, best eaten hot.'" },
    ] as ExampleOutput[],
  },

  social: {
    id: "social",
    name: "Social Media Agent",
    tagline: "Content, Engagement & Creator Partnerships",
    role: "Your AI content creator and influencer partnership manager",
    icon: Megaphone,
    color: "bg-purple-600",
    lightBg: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
    heroAccentColor: "text-purple-400",
    heroImg: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1600&q=80",
    heroAlt: "Social media content creation for food brands",
    contextImages: [
      { src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80", alt: "Beautiful food for social content", caption: "Content that makes people stop scrolling" },
      { src: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80", alt: "Restaurant kitchen for content", caption: "Behind the scenes, always on brand" },
      { src: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80", alt: "Food photography spread", caption: "Creator partnerships, managed for you" },
    ],
    intro: "Turn your food into content, your content into reach, and your reach into measurable orders — without posting, writing, or outreaching yourself.",
    outcomes: [
      { metric: "+3.8x", label: "Organic reach", sub: "vs. unmanaged accounts" },
      { metric: "4.2%", label: "Avg. engagement rate", sub: "Creator campaign average" },
      { metric: "2 posts/wk", label: "Consistent publishing", sub: "Fully automated" },
    ] as Outcome[],
    capabilityGroups: [
      { icon: CalendarDays, title: "Content Planning", tags: ["Weekly content calendar", "Post format guidance", "Shooting prompts", "Platform tailoring"] },
      { icon: TrendingUp, title: "Performance Insights", tags: ["Reach and engagement tracking", "Best-post identification", "Peak timing analysis", "Growth monitoring"] },
      { icon: Users2, title: "Creator Collaboration", tags: ["KOL/KOC sourcing", "Outreach brief creation", "Deliverable tracking", "Campaign attribution"] },
      { icon: Megaphone, title: "Campaign Ideas", tags: ["Short-form video concepts", "Campaign angles", "Trend-aligned formats", "Promotion tie-ins"] },
    ] as CapabilityGroup[],
    expectations: [
      { icon: BarChart2, title: "Engagement Summary", desc: "Posts, reach, and engagement trend direction" },
      { icon: TrendingUp, title: "Best Content Insights", desc: "What performed well and why it worked" },
      { icon: Megaphone, title: "Video Opportunities", desc: "Short-form concepts with estimated reach" },
      { icon: Users2, title: "Creator Suggestions", desc: "Outreach briefs and collaboration ideas ready to send" },
      { icon: Heart, title: "Audience Insights", desc: "Patterns drawn from comments and reactions" },
      { icon: CalendarDays, title: "Content Priorities", desc: "Next 7–30 day plan tied to your promotions" },
    ] as Expectation[],
    exampleOutputs: [
      { label: "Weekly report", text: "Kung Pao Chicken reel: 4,200 views, 312 saves, 87 shares — best post this month. Monday 7–9 PM is your peak engagement window. Schedule next week's content there." },
      { label: "Content idea", text: "Reel concept: 'The 30-second wok flip' — film the wok toss on your Kung Pao Chicken and overlay with trending audio. Estimated 3–5K reach based on current hashtag volume." },
      { label: "Creator shortlist", text: "5 local food creators identified: average 28K followers, 4.2% engagement rate, posted about Chinese cuisine in the last 30 days. Outreach brief ready for your approval." },
    ] as ExampleOutput[],
  },

  customer: {
    id: "customer",
    name: "Customer Service Agent",
    tagline: "Reviews, Reputation & Guest Retention",
    role: "Your AI reputation manager and retention specialist",
    icon: Headphones,
    color: "bg-teal-600",
    lightBg: "bg-teal-50",
    textColor: "text-teal-700",
    borderColor: "border-teal-200",
    heroAccentColor: "text-teal-400",
    heroImg: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80",
    heroAlt: "Warm restaurant dining room with guests",
    contextImages: [
      { src: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80", alt: "Restaurant hospitality moment", caption: "Every review, monitored in real time" },
      { src: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80", alt: "Customer service moment", caption: "Responses drafted within 2 hours" },
      { src: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80", alt: "Restaurant food for loyal customers", caption: "Win-back campaigns that bring guests back" },
    ],
    intro: "Monitor every review platform in real time, draft responses within hours, track complaint patterns, and build loyalty campaigns that turn one-time diners into regulars.",
    outcomes: [
      { metric: "+0.3★", label: "Rating improvement", sub: "Across all platforms" },
      { metric: "+14%", label: "Repeat order rate", sub: "From win-back campaigns" },
      { metric: "<2 hrs", label: "Avg. review response", sub: "Fully automated drafting" },
    ] as Outcome[],
    capabilityGroups: [
      { icon: Star, title: "Review Monitoring", tags: ["Google Maps and Yelp tracking", "Real-time review alerts", "Response drafting", "Brand-consistent tone"] },
      { icon: Heart, title: "Complaint Follow-Up", tags: ["Delivery issue logging", "Complaint pattern detection", "Resolution prioritization", "Operational fix suggestions"] },
      { icon: TrendingUp, title: "Reputation Improvement", tags: ["Rating trend analysis", "Sentiment scoring", "Improvement action plans", "Monthly reports"] },
      { icon: RotateCcw, title: "Retention Support", tags: ["Lapsed customer identification", "Win-back campaign design", "Loyalty tracking", "Reactivation testing"] },
    ] as CapabilityGroup[],
    expectations: [
      { icon: Star, title: "Rating Trends", desc: "Google Maps and Yelp week-over-week comparison" },
      { icon: Heart, title: "Sentiment Summaries", desc: "What customers love and what they complain about" },
      { icon: BarChart2, title: "Complaint Tracking", desc: "Volume, source, and resolution status" },
      { icon: CheckCircle2, title: "Follow-Up Priorities", desc: "Open service issues ranked by impact" },
      { icon: RotateCcw, title: "Win-Back Suggestions", desc: "Target segments and personalised offer ideas" },
      { icon: TrendingUp, title: "Campaign Performance", desc: "Results from previous retention actions" },
    ] as Expectation[],
    exampleOutputs: [
      { label: "Rating summary", text: "Overall rating holding at 4.6★ across Google and Yelp. 2 DoorDash complaints escalated this week — both responded to within 2 hours. Negative sentiment down 12% vs. last month." },
      { label: "Complaint pattern", text: "Top complaint this month: 'Missing sauce packets' — mentioned in 7 separate reviews. Recommend adding a kitchen checklist item and a note in your DoorDash packaging instructions." },
      { label: "Win-back campaign", text: "398 customers haven't ordered in 45+ days. Tier 1 (highest spenders): 87 guests. Recommend a 15% return offer targeting this group first — campaign ready for your approval." },
    ] as ExampleOutput[],
  },
} as const;

type AgentId = keyof typeof AGENT_CONFIG;
const AGENT_IDS: AgentId[] = ["operation", "chef", "social", "customer"];

// ─── Agent Visual Preview (mock UI cards per agent) ────────────────────────────

function OperationPreview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* KPI snapshot card */}
      <div className="md:col-span-2 bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Weekly Snapshot</p>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Week of Mar 14</span>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: "Orders", value: "+12%", sub: "this week", up: true },
            { label: "Revenue", value: "$4,280", sub: "total", up: true },
            { label: "Avg. Order", value: "$24.50", sub: "per order", up: false },
            { label: "ROAS", value: "3.1x", sub: "ad return", up: true },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-muted/40 rounded-xl p-3 text-center">
              <p className={cn("font-bold text-lg leading-none mb-1", kpi.up ? "text-green-600" : "text-foreground")}>{kpi.value}</p>
              <p className="text-[10px] font-semibold text-foreground">{kpi.label}</p>
              <p className="text-[9px] text-muted-foreground">{kpi.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Platform Comparison</p>
        <div className="space-y-2">
          {[
            { platform: "DoorDash", roas: "3.1x", width: "78%" },
            { platform: "Uber Eats", roas: "2.4x", width: "60%" },
          ].map((p) => (
            <div key={p.platform} className="flex items-center gap-3">
              <span className="text-xs text-foreground w-20 flex-shrink-0">{p.platform}</span>
              <div className="flex-1 bg-muted rounded-full h-2">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: p.width }} />
              </div>
              <span className="text-xs font-semibold text-foreground w-8 text-right">{p.roas}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Budget recommendation card */}
      <div className="flex flex-col gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-blue-700">Budget Recommendation</span>
          </div>
          <p className="text-xs text-blue-800 leading-snug mb-3">Reduce daily cap from <span className="font-bold">$1,300 → $700</span> to eliminate 2:30–5 PM waste window.</p>
          <div className="bg-white rounded-lg px-3 py-2 text-center border border-blue-100">
            <p className="text-xs text-muted-foreground">Estimated savings</p>
            <p className="font-bold text-blue-700 text-lg">$600/mo</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Weekly Priorities</p>
          {["Shift 20% budget to DoorDash", "Feature Combo A this weekend", "Review 2:30 PM slot performance"].map((item, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
              <span className="text-[10px] font-bold text-blue-600 w-4 flex-shrink-0">{i + 1}</span>
              <span className="text-[11px] text-foreground/80 leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChefPreview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Dish recommendation card */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center">
            <ChefHat className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-amber-700">New Dish Idea</span>
        </div>
        <div className="bg-white rounded-xl p-4 border border-amber-100 mb-3">
          <p className="font-bold text-sm text-foreground mb-1">Mango Chicken Bowl</p>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">TikTok Trending</span>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">240K+ posts</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">Based on your Hainanese Chicken base. Seasonal add: mango salsa, lime drizzle.</p>
        </div>
        <p className="text-[10px] text-amber-700 font-semibold">Confidence match: High · Trend window: 3–4 wks</p>
      </div>

      {/* Description upgrade card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center">
            <FileText className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-amber-700">Description Upgrade</span>
        </div>
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Before</p>
            <p className="text-xs text-muted-foreground italic">"Kung Pao Chicken with peanuts."</p>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="h-px flex-1 bg-border" />
            <ArrowRight className="w-3 h-3 text-amber-500 mx-2 flex-shrink-0" />
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-[9px] font-bold text-amber-700 uppercase mb-1">After</p>
            <p className="text-xs text-foreground leading-snug">"Wok-fired chicken with roasted chillies, crunchy peanuts, and a bold Sichuan glaze — built for delivery, best eaten hot."</p>
          </div>
        </div>
      </div>

      {/* Photo audit card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center">
            <Camera className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-amber-700">Photo Audit</span>
        </div>
        <div className="space-y-2">
          {[
            { item: "Steamed Fish Fillet", status: "Needs retake", ctr: "-18% CTR", bad: true },
            { item: "Kung Pao Chicken", status: "Performing well", ctr: "+24% CTR", bad: false },
            { item: "Spring Roll Set", status: "Needs retake", ctr: "-12% CTR", bad: true },
          ].map((row) => (
            <div key={row.item} className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 border", row.bad ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100")}>
              <div>
                <p className="text-[11px] font-semibold text-foreground">{row.item}</p>
                <p className={cn("text-[10px]", row.bad ? "text-red-600" : "text-green-600")}>{row.status}</p>
              </div>
              <span className={cn("text-[10px] font-bold", row.bad ? "text-red-600" : "text-green-600")}>{row.ctr}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SocialPreview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Best post card */}
      <div className="md:col-span-1 bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-purple-600 flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-purple-700">Best Post This Week</span>
        </div>
        <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl aspect-square flex items-center justify-center mb-3 border border-purple-100">
          <div className="text-center">
            <div className="text-4xl mb-2">🍜</div>
            <p className="text-[10px] font-bold text-purple-700">Kung Pao Reel</p>
          </div>
        </div>
        <div className="flex justify-between text-center">
          {[
            { icon: Eye, label: "Views", val: "4.2K" },
            { icon: Bookmark, label: "Saves", val: "312" },
            { icon: Share2, label: "Shares", val: "87" },
          ].map((stat) => (
            <div key={stat.label}>
              <stat.icon className="w-3 h-3 text-purple-500 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-foreground">{stat.val}</p>
              <p className="text-[9px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content idea card */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-purple-600 flex items-center justify-center">
            <Megaphone className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-purple-700">Next Content Idea</span>
        </div>
        <div className="bg-white border border-purple-100 rounded-xl p-4 mb-3">
          <p className="font-bold text-sm text-foreground mb-1">"The 30-second Wok Flip"</p>
          <p className="text-[11px] text-muted-foreground leading-snug mb-3">Film the wok toss on your Kung Pao Chicken and overlay with trending audio.</p>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Short-form Reel</span>
            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Trending audio</span>
          </div>
        </div>
        <p className="text-[11px] text-purple-700 font-semibold">Est. reach: 3,000–5,000 · Best slot: Mon 7–9 PM</p>
      </div>

      {/* Creator card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-purple-600 flex items-center justify-center">
            <Users2 className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-purple-700">Creator Match</span>
        </div>
        <div className="space-y-2">
          {[
            { handle: "@foodie_sg", followers: "28K", rate: "4.2%", tag: "Chinese cuisine" },
            { handle: "@theplatediaries", followers: "19K", rate: "5.1%", tag: "Delivery reviews" },
            { handle: "@sgfoodlover", followers: "34K", rate: "3.8%", tag: "Street food" },
          ].map((creator) => (
            <div key={creator.handle} className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5">
              <div>
                <p className="text-[11px] font-bold text-foreground">{creator.handle}</p>
                <p className="text-[10px] text-muted-foreground">{creator.followers} followers · {creator.tag}</p>
              </div>
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{creator.rate}</span>
            </div>
          ))}
          <p className="text-[10px] text-purple-600 font-semibold mt-1">Outreach brief ready for all 3</p>
        </div>
      </div>
    </div>
  );
}

function CustomerPreview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Overall rating card */}
      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-teal-600 flex items-center justify-center">
            <Star className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-teal-700">Overall Rating</span>
        </div>
        <div className="text-center mb-4">
          <p className="font-serif text-5xl font-bold text-teal-700 mb-1">4.6<span className="text-2xl">★</span></p>
          <p className="text-[11px] text-muted-foreground">across all platforms</p>
        </div>
        <div className="space-y-2">
          {[
            { platform: "Google Maps", rating: 4.7, stars: "★★★★★" },
            { platform: "Yelp", rating: 4.5, stars: "★★★★½" },
            { platform: "DoorDash", rating: 4.6, stars: "★★★★★" },
          ].map((p) => (
            <div key={p.platform} className="flex items-center justify-between">
              <span className="text-[11px] text-foreground">{p.platform}</span>
              <span className="text-[11px] font-bold text-teal-700">{p.rating}★</span>
            </div>
          ))}
        </div>
      </div>

      {/* Complaint theme card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-teal-600 flex items-center justify-center">
            <Heart className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-teal-700">Complaint Themes</span>
        </div>
        <div className="space-y-2">
          {[
            { theme: "Missing sauce packets", count: 7, severity: "High" },
            { theme: "Long wait times", count: 4, severity: "Medium" },
            { theme: "Cold food on delivery", count: 3, severity: "Medium" },
          ].map((c) => (
            <div key={c.theme} className="border border-border rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[11px] font-semibold text-foreground">{c.theme}</p>
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", c.severity === "High" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600")}>{c.severity}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Mentioned in {c.count} reviews this month</p>
            </div>
          ))}
        </div>
      </div>

      {/* Win-back campaign card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-teal-600 flex items-center justify-center">
            <RotateCcw className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-teal-700">Win-Back Campaign</span>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-3">
          <p className="text-[10px] font-bold text-teal-700 mb-1">Segment: Lapsed 45+ days</p>
          <div className="flex items-end gap-2 mb-2">
            <p className="font-bold text-2xl text-foreground">398</p>
            <p className="text-xs text-muted-foreground mb-0.5">customers</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg p-2 border border-teal-100 text-center">
              <p className="font-bold text-sm text-teal-700">87</p>
              <p className="text-[9px] text-muted-foreground">Tier 1 (high value)</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-teal-100 text-center">
              <p className="font-bold text-sm text-teal-700">15%</p>
              <p className="text-[9px] text-muted-foreground">Suggested offer</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <p className="text-[11px] text-teal-700 font-semibold">Campaign ready for your approval</p>
        </div>
      </div>
    </div>
  );
}

const PREVIEW_COMPONENTS: Record<AgentId, React.FC> = {
  operation: OperationPreview,
  chef: ChefPreview,
  social: SocialPreview,
  customer: CustomerPreview,
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const agent = agentId ? AGENT_CONFIG[agentId as AgentId] : undefined;

  if (!agent) return <NotFound />;

  const otherAgents = AGENT_IDS.filter((id) => id !== agent.id).map((id) => AGENT_CONFIG[id]);
  const PreviewComponent = PREVIEW_COMPONENTS[agentId as AgentId];

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          className="relative min-h-[62vh] flex items-end overflow-hidden"
          data-testid="section-agent-hero"
        >
          {/* Background food image */}
          <div className="absolute inset-0">
            <img
              src={agent.heroImg}
              alt={agent.heroAlt}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/20" />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 pt-36 w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="flex items-center gap-3 mb-5">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", agent.color)}>
                  <agent.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-white/50 text-xs font-bold uppercase tracking-widest">AI Agent</span>
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-3" data-testid="text-agent-name">
                {agent.name}
              </h1>
              <p className="text-white/60 text-lg md:text-xl mb-8 max-w-xl leading-relaxed">{agent.tagline}</p>

              {/* Metric chips */}
              <div className="flex flex-wrap gap-3 mb-8">
                {agent.outcomes.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur-sm rounded-full px-4 py-1.5">
                    <span className={cn("font-bold text-base", agent.heroAccentColor)}>{o.metric}</span>
                    <span className="text-white/70 text-sm">{o.label}</span>
                  </div>
                ))}
              </div>

              <Button size="lg" asChild data-testid="button-agent-start">
                <Link href="/register">
                  Get This Agent Working <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* ── Role intro ───────────────────────────────────────────────────── */}
        <section className="py-14 md:py-18 bg-background" data-testid="section-agent-intro">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="flex items-start gap-5 max-w-3xl">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1", agent.lightBg)}>
                  <agent.icon className={cn("w-5 h-5", agent.textColor)} />
                </div>
                <div>
                  <Badge variant="secondary" className="mb-3">{agent.role}</Badge>
                  <p className="text-foreground/80 text-lg md:text-xl leading-relaxed">{agent.intro}</p>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ── Capability groups ─────────────────────────────────────────────── */}
        <section className="py-14 md:py-20 bg-card" data-testid="section-agent-handles">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">Scope of work</p>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold" data-testid="text-handles-headline">
                What the {agent.name}{" "}
                <span className="text-primary">handles for your restaurant</span>
              </h2>
            </RevealOnScroll>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {agent.capabilityGroups.map((group, i) => (
                <RevealOnScroll key={i} delay={i * 0.08}>
                  <div className="h-full rounded-2xl border border-border bg-background p-5 hover-elevate" data-testid={`card-capability-group-${i}`}>
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-4", agent.lightBg)}>
                      <group.icon className={cn("w-4.5 h-4.5", agent.textColor)} />
                    </div>
                    <h3 className="font-bold text-foreground text-base mb-3">{group.title}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map((tag) => (
                        <span key={tag} className={cn("text-xs font-medium px-2 py-1 rounded-lg", agent.lightBg, agent.textColor)}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── Context image strip ──────────────────────────────────────────── */}
        <section className="py-10 bg-background" data-testid="section-agent-context-images">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-3 gap-4">
              {agent.contextImages.map((img, i) => (
                <RevealOnScroll key={i} delay={i * 0.08}>
                  <div className="overflow-hidden rounded-xl group" data-testid={`img-context-${i}`}>
                    <div className="aspect-[4/3] overflow-hidden">
                      <img
                        src={img.src}
                        alt={img.alt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-2.5 text-xs text-muted-foreground font-medium text-center">{img.caption}</p>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── Agent-specific visual preview ─────────────────────────────────── */}
        <section className="py-14 md:py-20 bg-background" data-testid="section-agent-preview">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">What it looks like</p>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold">
                Insights your agent <span className="text-primary">surfaces for you</span>
              </h2>
              <p className="mt-2 text-muted-foreground text-base max-w-xl">
                A preview of the cards, reports, and recommendations your {agent.name} generates inside your Boardroom.
              </p>
            </RevealOnScroll>
            <RevealOnScroll>
              <PreviewComponent />
            </RevealOnScroll>
          </div>
        </section>

        {/* ── What you can expect ───────────────────────────────────────────── */}
        <section className="py-14 md:py-20 bg-card" data-testid="section-agent-expectations">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">Practical outputs</p>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold">
                What you can expect{" "}
                <span className="text-primary">from this agent</span>
              </h2>
              <p className="mt-2 text-muted-foreground text-base max-w-xl">
                These are the concrete outputs and business signals your team receives — every week, automatically.
              </p>
            </RevealOnScroll>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agent.expectations.map((exp, i) => (
                <RevealOnScroll key={i} delay={i * 0.07}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-start gap-4 p-5 rounded-2xl border border-border bg-background hover-elevate"
                    data-testid={`card-expectation-${i}`}
                  >
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", agent.lightBg)}>
                      <exp.icon className={cn("w-4.5 h-4.5", agent.textColor)} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-base mb-1">{exp.title}</p>
                      <p className="text-sm text-muted-foreground leading-snug">{exp.desc}</p>
                    </div>
                  </motion.div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── Example outputs ──────────────────────────────────────────────── */}
        <section className="py-14 md:py-20 bg-[#2A2A2A]" data-testid="section-agent-examples">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10">
              <Badge className="mb-4 bg-white/10 text-white border-white/20">Boardroom Messages</Badge>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-white" data-testid="text-examples-headline">
                Real recommendations from<br />
                <span className="text-primary">this agent</span>
              </h2>
              <p className="mt-3 text-white/50 text-base max-w-xl">
                These are the kinds of messages your {agent.name} sends directly to your Boardroom.
              </p>
            </RevealOnScroll>

            <div className="space-y-4 max-w-3xl">
              {agent.exampleOutputs.map((output, i) => (
                <RevealOnScroll key={i} delay={i * 0.1}>
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12 }}
                    className="flex gap-4"
                    data-testid={`card-example-${i}`}
                  >
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", agent.color)}>
                      <agent.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className={cn("text-[10px] font-bold uppercase tracking-widest", agent.textColor.replace("700", "400"))}>
                        {output.label}
                      </span>
                      <div className="mt-1 bg-white/6 border border-white/10 rounded-xl px-4 py-3.5">
                        <p className="text-white/80 text-sm leading-relaxed">{output.text}</p>
                      </div>
                    </div>
                  </motion.div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── Other agents ─────────────────────────────────────────────────── */}
        <section className="py-14 md:py-20 bg-background" data-testid="section-other-agents">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealOnScroll className="mb-10">
              <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">The AI Team</p>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold">
                The other agents working <span className="text-primary">alongside this one</span>
              </h2>
            </RevealOnScroll>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {otherAgents.map((oa) => (
                <RevealOnScroll key={oa.id}>
                  <Link href={`/agents/${oa.id}`} data-testid={`link-agent-${oa.id}`}>
                    <div className="group p-5 rounded-2xl border border-border bg-card hover-elevate h-full flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", oa.color)}>
                        <oa.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">{oa.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{oa.tagline}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section className="py-20 md:py-28 bg-foreground" data-testid="section-agent-cta">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <RevealOnScroll>
              <p className="text-white/50 text-sm font-semibold uppercase tracking-widest mb-4">Start growing</p>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 max-w-2xl mx-auto leading-tight">
                Put the {agent.name} to work for your restaurant
              </h2>
              <p className="text-white/60 text-lg max-w-xl mx-auto mb-8">
                Set up takes under 10 minutes. Your AI team starts monitoring, recommending, and acting from day one.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" asChild data-testid="button-cta-start">
                  <Link href="/register">
                    Start Free Trial <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10" asChild data-testid="button-cta-boardroom">
                  <Link href="/">
                    See the Boardroom
                  </Link>
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
