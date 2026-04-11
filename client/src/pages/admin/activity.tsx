import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import {
  CheckCircle2, Circle, AlertCircle, Briefcase, ChefHat,
  Megaphone, Headphones, Star, TrendingUp, Zap, ArrowUpRight,
  Filter, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentId = "operation" | "chef" | "social" | "customer";
type ActivityStatus = "done" | "pending" | "flagged";
type TimeGroup = "Today" | "Yesterday" | "3 Days Ago" | "This Week";

interface SubDetail {
  label: string;
  value: string;
}

interface ActivityItem {
  id: number;
  timeGroup: TimeGroup;
  time: string;
  agentId: AgentId;
  category: string;
  title: string;
  detail: string;
  status: ActivityStatus;
  impact?: string;
  impactUp?: boolean;
  subDetails?: SubDetail[];
  previewImg?: string;
  previewGradient?: string;
  previewLabel?: string;
  chips?: string[];
  actionLabel?: string;
}

// ─── Agent Config ─────────────────────────────────────────────────────────────

const AGENTS: Record<AgentId, { name: string; icon: React.ElementType; avatar: string; badge: string }> = {
  operation: { name: "Operation Agent", icon: Briefcase, avatar: "bg-blue-600", badge: "bg-blue-100 text-blue-700" },
  chef: { name: "Chef Agent", icon: ChefHat, avatar: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  social: { name: "Social Media Agent", icon: Megaphone, avatar: "bg-purple-600", badge: "bg-purple-100 text-purple-700" },
  customer: { name: "Customer Service Agent", icon: Headphones, avatar: "bg-teal-600", badge: "bg-teal-100 text-teal-700" },
};

const categoryColor: Record<string, string> = {
  Delivery: "bg-blue-100 text-blue-700",
  Content: "bg-purple-100 text-purple-700",
  Reputation: "bg-amber-100 text-amber-700",
  Creators: "bg-pink-100 text-pink-700",
  Retention: "bg-green-100 text-green-700",
  Menu: "bg-orange-100 text-orange-700",
  Social: "bg-teal-100 text-teal-700",
  Budget: "bg-indigo-100 text-indigo-700",
};

const CATEGORY_DISPLAY_KEYS: Record<string, string> = {
  Delivery: "activity.cat_delivery",
  Content: "activity.cat_content",
  Reputation: "activity.cat_reputation",
  Creators: "activity.cat_creators",
  Retention: "activity.cat_retention",
  Menu: "activity.cat_menu",
  Social: "activity.cat_social",
  Budget: "activity.cat_budget",
};

// ─── Activity Data ────────────────────────────────────────────────────────────

const ACTIVITIES: ActivityItem[] = [
  {
    id: 1,
    timeGroup: "Today",
    time: "2 hours ago",
    agentId: "social",
    category: "Content",
    title: "3 short-form video drafts are ready for your approval",
    detail: "Clips 03, 04, and 05 were generated for Instagram Reels and TikTok. All three follow the sizzle-and-reveal format that outperformed your account average by 2x last week.",
    status: "pending",
    impact: "+2,800 reach est.",
    impactUp: true,
    actionLabel: "Review Drafts",
    previewGradient: "from-purple-400 via-pink-400 to-rose-400",
    previewLabel: "3 Video Drafts",
    chips: ["Clip 03 – Kung Pao Chicken reveal", "Clip 04 – Kitchen behind-the-scenes", "Clip 05 – Combo meal showcase"],
  },
  {
    id: 2,
    timeGroup: "Today",
    time: "4 hours ago",
    agentId: "operation",
    category: "Budget",
    title: "Delivery ad budget recommendation flagged for review",
    detail: "Current monthly cap of $1,300 is generating wasted spend in the 2:30–5 PM low-conversion window. AI recommends reducing to $700 to preserve peak-hour coverage while eliminating afternoon waste.",
    status: "pending",
    impact: "$600 est. savings/mo",
    impactUp: true,
    actionLabel: "Apply $700 Cap",
    subDetails: [
      { label: "Current cap", value: "$1,300 / mo" },
      { label: "Recommended cap", value: "$700 / mo" },
      { label: "Waste window", value: "2:30 – 5:00 PM" },
      { label: "Peak-hour coverage", value: "94% retained" },
    ],
  },
  {
    id: 3,
    timeGroup: "Today",
    time: "6 hours ago",
    agentId: "operation",
    category: "Delivery",
    title: "Menu upsell prompts updated on Uber Eats and DoorDash",
    detail: "Checkout prompts for Milk Tea add-on and Spring Roll upgrade were enabled on both platforms. Based on current order volume, projected to add $0.81 to average order value.",
    status: "done",
    impact: "+$0.81 avg order value",
    impactUp: true,
    subDetails: [
      { label: "Uber Eats", value: "Active" },
      { label: "DoorDash", value: "Active" },
      { label: "Milk Tea attach target", value: "32%" },
      { label: "Current attach rate", value: "18%" },
    ],
  },
  {
    id: 4,
    timeGroup: "Yesterday",
    time: "Yesterday, 9:15 AM",
    agentId: "customer",
    category: "Reputation",
    title: "Monthly reputation report published — 48 reviews, 4.6 ★ avg",
    detail: "Customer Service Agent compiled reviews across Google, Yelp, Uber Eats, and DoorDash. 41 positive, 5 neutral, 2 negative (both flagged for follow-up). DoorDash rating dipped to 4.3★ — escalation in progress.",
    status: "done",
    impact: "Rating: 4.6 ★ (+0.1)",
    impactUp: true,
    subDetails: [
      { label: "Google Maps", value: "4.7 ★ · 28 reviews" },
      { label: "Yelp", value: "4.4 ★ · 14 reviews" },
      { label: "Uber Eats", value: "4.8 ★ · 12 reviews" },
      { label: "DoorDash", value: "4.3 ★ · 8 reviews ⚠" },
    ],
  },
  {
    id: 5,
    timeGroup: "Yesterday",
    time: "Yesterday, 11:40 AM",
    agentId: "operation",
    category: "Delivery",
    title: "Ad spend rebalanced — more budget shifted to Uber Eats lunch window",
    detail: "Uber Eats 12–2 PM bid increased by 25%. DoorDash afternoon bids reduced by 60%. Rebalancing based on ROAS analysis: Uber Eats lunch hour averaging 5.1x vs DoorDash afternoon at 1.2x.",
    status: "done",
    impact: "ROAS est. +0.4x",
    impactUp: true,
    subDetails: [
      { label: "Uber Eats 12–2 PM bid", value: "+25%" },
      { label: "DoorDash 2:30–5 PM bid", value: "−60%" },
      { label: "Uber Eats ROAS", value: "3.1x (+0.4x)" },
      { label: "DoorDash ROAS", value: "2.8x" },
    ],
  },
  {
    id: 6,
    timeGroup: "Yesterday",
    time: "Yesterday, 2:00 PM",
    agentId: "social",
    category: "Creators",
    title: "Creator shortlist prepared — 5 candidates ready for approval",
    detail: "Social Media Agent identified 5 Downtown micro-influencers specializing in food content. Combined estimated reach: 193k. Campaign budget needed: $400–$600 per campaign. Past creator ROI: 3.8x.",
    status: "pending",
    impact: "193k combined reach",
    impactUp: true,
    actionLabel: "View Shortlist",
    chips: ["@downtownfoodiejen · 42k", "@eatlocalmike · 28k", "@citybitesblog · 71k", "@tastetheblock · 19k", "@lunchhourfoodie · 33k"],
    previewGradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    previewLabel: "5 Creators",
  },
  {
    id: 7,
    timeGroup: "3 Days Ago",
    time: "3 days ago, 8:30 AM",
    agentId: "customer",
    category: "Retention",
    title: "Win-back segment refreshed — 398 lapsed customers identified",
    detail: "Customer Service Agent identified 398 customers with no orders in 45+ days. Segmented into 3 tiers by order value. Tiered reactivation campaign drafted and awaiting deployment approval.",
    status: "done",
    impact: "$5,300 est. recovery",
    impactUp: true,
    subDetails: [
      { label: "Tier 1 (high value)", value: "142 customers" },
      { label: "Tier 2 (mid value)", value: "189 customers" },
      { label: "Tier 3 (low value)", value: "67 customers" },
      { label: "Estimated recovery", value: "$5,300" },
    ],
  },
  {
    id: 8,
    timeGroup: "3 Days Ago",
    time: "3 days ago, 10:15 AM",
    agentId: "chef",
    category: "Menu",
    title: "Menu photo audit completed — 3 items flagged for refresh",
    detail: "Chef Agent reviewed all 24 active menu items for photo quality. Steamed Fish Fillet, Hot & Sour Soup, and Mango Milk Tea were rated below standard. New photo briefs have been generated for each.",
    status: "flagged",
    impact: "Click-through est. +25%",
    impactUp: true,
    chips: ["Steamed Fish Fillet — too dark, no garnish", "Hot & Sour Soup — no texture visible", "Mango Milk Tea — no branded photo"],
    previewImg: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&q=80",
  },
  {
    id: 9,
    timeGroup: "3 Days Ago",
    time: "3 days ago, 3:00 PM",
    agentId: "chef",
    category: "Menu",
    title: "4 new dish ideas generated based on trending food content",
    detail: "Chef Agent analyzed TikTok food trends, seasonal demand, and local competitor gaps. Four dish concepts are ready for kitchen evaluation: Mango Chicken Rice Bowl, Spicy Garlic Wings, Cold Sesame Noodle Bowl, and Crispy Tofu Bento.",
    status: "done",
    impact: "Est. +$4,500/mo revenue",
    impactUp: true,
    chips: ["Mango Chicken Rice Bowl", "Spicy Garlic Wings", "Cold Sesame Noodle Bowl", "Crispy Tofu Bento"],
    previewImg: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=120&q=80",
  },
  {
    id: 10,
    timeGroup: "This Week",
    time: "4 days ago",
    agentId: "social",
    category: "Social",
    title: "Weekly content calendar published — 12 posts scheduled",
    detail: "Social Media Agent scheduled 12 posts across Instagram and TikTok for the week. Mix of Reels (5), Stories (5), and static posts (2). Top anticipated post: Kung Pao Chicken sizzle reel — Tuesday 12:30 PM.",
    status: "done",
    impact: "14,200 reach projected",
    impactUp: true,
    previewGradient: "from-fuchsia-400 via-purple-400 to-blue-400",
    previewLabel: "12 Posts Scheduled",
    subDetails: [
      { label: "Instagram Reels", value: "5 posts" },
      { label: "Stories", value: "5 posts" },
      { label: "Static posts", value: "2 posts" },
      { label: "Projected reach", value: "14,200" },
    ],
  },
  {
    id: 11,
    timeGroup: "This Week",
    time: "5 days ago",
    agentId: "operation",
    category: "Delivery",
    title: "BOGO Spring Roll promotion launched on Uber Eats",
    detail: "BOGO Spring Roll Set promotion is live on Uber Eats. Promotion runs through end of month. Early performance: +34 incremental orders in 48 hours, well above the 20-order breakeven threshold.",
    status: "done",
    impact: "+34 orders in 48h",
    impactUp: true,
    subDetails: [
      { label: "Platform", value: "Uber Eats" },
      { label: "Promo type", value: "BOGO" },
      { label: "Orders generated", value: "34 in 48h" },
      { label: "Breakeven threshold", value: "20 orders" },
    ],
  },
  {
    id: 12,
    timeGroup: "This Week",
    time: "6 days ago",
    agentId: "customer",
    category: "Retention",
    title: "Repeat-order lunch campaign sent to 312 past customers",
    detail: "Customer Service Agent deployed a targeted SMS campaign to past customers who ordered lunch items. 11.3% click-through rate — above the 8% benchmark. 43 re-orders attributed to this campaign.",
    status: "done",
    impact: "11.3% CTR · $1,935 revenue",
    impactUp: true,
    subDetails: [
      { label: "Recipients", value: "312 customers" },
      { label: "Click-through rate", value: "11.3%" },
      { label: "Re-orders", value: "43" },
      { label: "Revenue attributed", value: "$1,935" },
    ],
  },
  {
    id: 13,
    timeGroup: "This Week",
    time: "6 days ago",
    agentId: "customer",
    category: "Reputation",
    title: "2 negative DoorDash reviews responded to within 2 hours",
    detail: "Customer Service Agent detected two 1-star reviews on DoorDash citing long delivery wait times. Personalized responses were posted and recovery offers (10% off next order) were sent to both customers within 2 hours.",
    status: "done",
    impact: "100% response rate",
    impactUp: true,
    subDetails: [
      { label: "Reviews responded to", value: "2 of 2" },
      { label: "Response time", value: "< 2 hours" },
      { label: "Recovery offer", value: "10% off" },
      { label: "Customer recovered", value: "1 of 2 so far" },
    ],
  },
];

// ─── Summary Stats ────────────────────────────────────────────────────────────

function SummaryStats() {
  const { t } = useTranslation();
  const pending = ACTIVITIES.filter((a) => a.status === "pending").length;
  const doneToday = ACTIVITIES.filter((a) => a.timeGroup === "Today" && a.status === "done").length;
  const total = ACTIVITIES.length;

  const stats = [
    { label: t("activity.stat_total"), value: String(total), icon: Zap, color: "text-foreground" },
    { label: t("activity.stat_awaiting"), value: String(pending), icon: AlertCircle, color: "text-amber-600" },
    { label: t("activity.stat_completed"), value: String(doneToday), icon: CheckCircle2, color: "text-green-600" },
    { label: t("activity.stat_agents"), value: "4", icon: TrendingUp, color: "text-blue-600" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      {stats.map((s) => (
        <div key={s.label} className="bg-card border border-border rounded-xl px-5 py-4 flex items-start gap-3">
          <s.icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", s.color)} />
          <div>
            <p className="font-serif text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ item }: { item: ActivityItem }) {
  const { t } = useTranslation();
  const [actioned, setActioned] = useState(false);
  const agent = AGENTS[item.agentId];
  const AgentIcon = agent.icon;

  return (
    <div className={cn(
      "bg-card border rounded-2xl p-5 transition-shadow hover:shadow-sm",
      item.status === "pending" ? "border-amber-200 bg-amber-50/30" :
      item.status === "flagged" ? "border-red-200 bg-red-50/20" :
      "border-border"
    )} data-testid={`card-activity-${item.id}`}>

      <div className="flex gap-4">
        {/* Visual preview */}
        {(item.previewImg || item.previewGradient) && (
          <div className="flex-shrink-0">
            {item.previewImg ? (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted">
                <img src={item.previewImg} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={cn("w-16 h-16 rounded-xl bg-gradient-to-br flex items-center justify-center", item.previewGradient)}>
                <p className="text-white text-sm font-bold text-center leading-tight px-1">{t(`activity.a${item.id}_preview`, { defaultValue: item.previewLabel })}</p>
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start gap-2 mb-2 flex-wrap">
            {/* Agent pill */}
            <div className="flex items-center gap-1.5">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0", agent.avatar)}>
                <AgentIcon className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">{t(`activity.agent_${item.agentId}`)}</span>
            </div>
            <span className={cn("text-sm font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide", categoryColor[item.category] ?? "bg-muted text-muted-foreground")}>
              {t(CATEGORY_DISPLAY_KEYS[item.category] ?? item.category, { defaultValue: item.category })}
            </span>
            {item.status === "pending" && (
              <span className="text-sm font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{t("activity.status_needs_approval")}</span>
            )}
            {item.status === "flagged" && (
              <span className="text-sm font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{t("activity.status_flagged")}</span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-foreground leading-snug mb-1.5">{t(`activity.a${item.id}_title`, { defaultValue: item.title })}</p>

          {/* Detail */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t(`activity.a${item.id}_detail`, { defaultValue: item.detail })}</p>

          {/* Chips / Sub-items */}
          {item.chips && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {item.chips.map((c, ci) => (
                <span key={ci} className="text-sm px-2.5 py-1 rounded-full border border-border bg-background text-foreground/70">{t(`activity.a${item.id}_chip${ci}`, { defaultValue: c })}</span>
              ))}
            </div>
          )}

          {/* Sub details grid */}
          {item.subDetails && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 mb-3 px-4 py-3 bg-background border border-border rounded-xl">
              {item.subDetails.map((d, si) => (
                <div key={d.label}>
                  <p className="text-sm text-muted-foreground">{t(`activity.a${item.id}_sub${si}_label`, { defaultValue: d.label })}</p>
                  <p className="text-sm font-semibold text-foreground">{d.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {/* Status icon */}
              <div className="flex items-center gap-1.5">
                {item.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                {item.status === "pending" && <Circle className="w-3.5 h-3.5 text-amber-500" />}
                {item.status === "flagged" && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                <span className="text-sm text-muted-foreground">{t(`activity.a${item.id}_time`, { defaultValue: item.time })}</span>
              </div>

              {/* Impact pill */}
              {item.impact && (
                <div className="flex items-center gap-1">
                  <ArrowUpRight className={cn("w-3 h-3", item.impactUp ? "text-green-600" : "text-red-500")} />
                  <span className={cn("text-sm font-semibold", item.impactUp ? "text-green-700" : "text-red-600")}>{t(`activity.a${item.id}_impact`, { defaultValue: item.impact })}</span>
                </div>
              )}
            </div>

            {/* Action */}
            {item.actionLabel && item.status === "pending" && (
              actioned ? (
                <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t("activity.approved")}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <Button size="sm" className="text-sm" onClick={() => setActioned(true)} data-testid={`button-approve-${item.id}`}>
                    {t(`activity.a${item.id}_action`, { defaultValue: item.actionLabel })}
                  </Button>
                  <Button size="sm" variant="outline" className="text-sm" data-testid={`button-dismiss-${item.id}`}>
                    {t("activity.dismiss")}
                  </Button>
                </div>
              )
            )}

            {item.status === "done" && (
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="w-3 h-3" /> {t("activity.view_details")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

const FILTERS = ["All", "Pending", "Operations", "Content", "Reputation", "Retention"] as const;
type FilterType = typeof FILTERS[number];

function filterItems(items: ActivityItem[], filter: FilterType): ActivityItem[] {
  if (filter === "All") return items;
  if (filter === "Pending") return items.filter((i) => i.status === "pending");
  if (filter === "Operations") return items.filter((i) => ["Delivery", "Budget"].includes(i.category));
  if (filter === "Content") return items.filter((i) => ["Content", "Social", "Creators", "Menu"].includes(i.category));
  if (filter === "Reputation") return items.filter((i) => i.category === "Reputation");
  if (filter === "Retention") return items.filter((i) => i.category === "Retention");
  return items;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TIME_GROUPS: TimeGroup[] = ["Today", "Yesterday", "3 Days Ago", "This Week"];

const FILTER_LABEL_KEYS: Record<FilterType, string> = {
  All: "activity.filter_all",
  Pending: "activity.filter_pending",
  Operations: "activity.filter_operations",
  Content: "activity.filter_content",
  Reputation: "activity.filter_reputation",
  Retention: "activity.filter_retention",
};

const TIME_GROUP_LABEL_KEYS: Record<TimeGroup, string> = {
  Today: "activity.group_today",
  Yesterday: "activity.group_yesterday",
  "3 Days Ago": "activity.group_3days",
  "This Week": "activity.group_this_week",
};

export default function AdminActivity() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const filtered = filterItems(ACTIVITIES, activeFilter);
  const pending = ACTIVITIES.filter((a) => a.status === "pending").length;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5 sticky top-0 z-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">{t("activity.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("activity.subtitle")}</p>
          </div>
          {pending > 0 && (
            <div className="flex items-center gap-2 bg-amber-100 border border-amber-200 text-amber-800 text-sm font-semibold px-3 py-1.5 rounded-full flex-shrink-0">
              <AlertCircle className="w-3.5 h-3.5" />
              {pending} {t("activity.awaiting_approval")}
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5" data-testid="activity-filter-tabs">
          <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mr-1" />
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "text-sm font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors",
                activeFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              data-testid={`tab-filter-${f.toLowerCase()}`}
            >
              {t(FILTER_LABEL_KEYS[f])}
              {f === "Pending" && pending > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-sm font-bold rounded-full px-1.5 py-0.5">{pending}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Summary stats */}
        <SummaryStats />

        {/* Grouped feed */}
        {TIME_GROUPS.map((group) => {
          const groupItems = filtered.filter((i) => i.timeGroup === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t(TIME_GROUP_LABEL_KEYS[group])}</p>
                <div className="flex-1 border-t border-border" />
                <span className="text-sm text-muted-foreground">{groupItems.length} {groupItems.length === 1 ? t("activity.action_singular") : t("activity.action_plural")}</span>
              </div>
              <div className="space-y-4">
                {groupItems.map((item) => (
                  <ActivityCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">{t("activity.empty_title")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("activity.empty_desc")}</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
