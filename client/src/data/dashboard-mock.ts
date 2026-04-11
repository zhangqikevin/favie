// ─── KPI Cards ───────────────────────────────────────────────────────────────
export const kpiCards = [
  {
    id: "total-orders",
    label: "Total Orders",
    value: "1,284",
    trend: "+12.4%",
    positive: true,
    note: "vs previous 30 days",
  },
  {
    id: "online-revenue",
    label: "Online Revenue",
    value: "$28,460",
    trend: "+9.8%",
    positive: true,
    note: "delivery + direct digital channels",
  },
  {
    id: "avg-order-value",
    label: "Avg Order Value",
    value: "$22.17",
    trend: "+6.1%",
    positive: true,
    note: "driven by bundle and add-on improvements",
  },
  {
    id: "repeat-customer-rate",
    label: "Repeat Customer Rate",
    value: "31%",
    trend: "+4.2%",
    positive: true,
    note: "returning customers in selected period",
  },
  {
    id: "avg-review-rating",
    label: "Avg Review Rating",
    value: "4.6 ★",
    trend: "+0.2",
    positive: true,
    note: "across major platforms",
  },
  {
    id: "campaign-engagement",
    label: "Campaign Engagement",
    value: "18.9%",
    trend: "+3.5%",
    positive: true,
    note: "social + retention activity engagement",
  },
];

// ─── Chart Data ───────────────────────────────────────────────────────────────
export const ordersRevenueData = [
  { week: "Week 1", orders: 260, revenue: 5480 },
  { week: "Week 2", orders: 292, revenue: 6120 },
  { week: "Week 3", orders: 318, revenue: 7020 },
  { week: "Week 4", orders: 414, revenue: 9840 },
];

export const repeatCustomerData = [
  { week: "Week 1", rate: 24 },
  { week: "Week 2", rate: 27 },
  { week: "Week 3", rate: 29 },
  { week: "Week 4", rate: 31 },
];

export const reviewScoreData = [
  { week: "W1", score: 4.3 },
  { week: "W2", score: 4.4 },
  { week: "W3", score: 4.5 },
  { week: "W4", score: 4.6 },
];

export const contentEngagementData = [
  { week: "W1", rate: 11.2 },
  { week: "W2", rate: 13.8 },
  { week: "W3", rate: 16.1 },
  { week: "W4", rate: 18.9 },
];

// ─── Growth Performance Areas ─────────────────────────────────────────────────
export const performanceAreas = [
  {
    id: "delivery",
    title: "Delivery Performance",
    subtitle: "Visibility and storefront conversion across delivery channels",
    fields: [
      { label: "Ad-driven visits", value: "3,240" },
      { label: "Storefront conversion rate", value: "8.4%" },
      { label: "Best-performing platform", value: "Uber Eats" },
      { label: "Top campaign", value: "Lunch Rush Promo" },
      { label: "Change vs prior period", value: "+11.7%", positive: true },
    ],
  },
  {
    id: "menu",
    title: "Menu Performance",
    subtitle: "Bundle, pricing, and upsell effectiveness",
    fields: [
      { label: "Best-selling bundle", value: "Family Combo A" },
      { label: "Upsell attach rate", value: "14.2%" },
      { label: "Highest-converting category", value: "Rice Bowls" },
      { label: "Lowest-converting category", value: "Drinks" },
      { label: "Avg ticket change", value: "+5.6%", positive: true },
    ],
  },
  {
    id: "social",
    title: "Social Performance",
    subtitle: "Content output and audience engagement",
    fields: [
      { label: "Posts published", value: "12" },
      { label: "Total reach", value: "24,300" },
      { label: "Engagement rate", value: "6.8%" },
      { label: "Best-performing format", value: "Short video" },
      { label: "Best-performing topic", value: "Behind-the-scenes kitchen clips" },
    ],
  },
  {
    id: "reputation",
    title: "Reputation Performance",
    subtitle: "Review quality and customer response",
    fields: [
      { label: "New reviews", value: "48" },
      { label: "Average rating", value: "4.6" },
      { label: "Review response rate", value: "87%" },
      { label: "Positive sentiment trend", value: "Improving" },
      { label: "Main issue mentioned", value: "Delivery delay during dinner rush" },
    ],
  },
  {
    id: "retention",
    title: "Retention Performance",
    subtitle: "Repeat business and customer reactivation",
    fields: [
      { label: "Returning customers", value: "398" },
      { label: "Repeat customer rate", value: "31%" },
      { label: "Reactivation campaign CTR", value: "11.3%" },
      { label: "Offer redemption rate", value: "8.7%" },
      { label: "Best-performing offer", value: "Free drink with combo order" },
    ],
  },
];

// ─── Weekly Priorities ────────────────────────────────────────────────────────
export const priorities = [
  {
    id: 1,
    task: "Update 2 underperforming drink add-ons to improve attach rate",
    priority: "High",
    owner: "Account Team",
    due: "Mar 18",
    status: "In Progress",
  },
  {
    id: 2,
    task: "Respond to 5 recent 3-star reviews mentioning wait time",
    priority: "High",
    owner: "Account Team",
    due: "Mar 17",
    status: "Pending",
  },
  {
    id: 3,
    task: "Approve next week's short video content calendar",
    priority: "Medium",
    owner: "You",
    due: "Mar 18",
    status: "Awaiting Approval",
  },
  {
    id: 4,
    task: "Launch repeat-order lunch campaign for past 30-day customers",
    priority: "High",
    owner: "Account Team",
    due: "Mar 20",
    status: "Scheduled",
  },
  {
    id: 5,
    task: "Refresh Uber Eats storefront hero images",
    priority: "Medium",
    owner: "Account Team",
    due: "Mar 21",
    status: "In Progress",
  },
  {
    id: 6,
    task: "Review creator shortlist for next local promotion push",
    priority: "Low",
    owner: "You",
    due: "Mar 22",
    status: "Pending",
  },
];

// ─── Recent Activity ──────────────────────────────────────────────────────────
export const activityFeed = [
  { id: 1, time: "2 hours ago", text: "Menu upsell recommendations were updated" },
  { id: 2, time: "5 hours ago", text: "3 new short-form video drafts were generated" },
  { id: 3, time: "Yesterday", text: "Reputation summary report was published" },
  { id: 4, time: "Yesterday", text: "Delivery ad campaign budget allocation was adjusted" },
  { id: 5, time: "2 days ago", text: "Creator shortlist for local collaboration was prepared" },
  { id: 6, time: "3 days ago", text: "Repeat customer segment was refreshed for reactivation campaign" },
];

// ─── Opportunities & Alerts ───────────────────────────────────────────────────
export const insights = [
  {
    id: 1,
    type: "Opportunity",
    text: "Bundle conversion is improving, but drink add-ons are still underperforming. Updating the drink upsell structure could increase average ticket size further.",
  },
  {
    id: 2,
    type: "Alert",
    text: "Review sentiment remains positive overall, but delivery speed complaints increased during the last 7 days.",
  },
  {
    id: 3,
    type: "Opportunity",
    text: "Short-form video content is producing the strongest engagement. Consider increasing video frequency next month.",
  },
  {
    id: 4,
    type: "Opportunity",
    text: "Returning customer rate is rising. A stronger loyalty offer could push repeat sales further.",
  },
];

// ─── Quick Links ──────────────────────────────────────────────────────────────
export const quickLinks = [
  { id: "delivery-ads", label: "Delivery Ads & Storefront", href: "/admin/delivery" },
  { id: "menu-bundles", label: "Menu / Bundles / Upsell", href: "/admin/menu" },
  { id: "social-media", label: "Social Media", href: "/admin/social" },
  { id: "short-video", label: "Short Video Content", href: "/admin/video" },
  { id: "kol-collab", label: "KOL / KOC Collaboration", href: "/admin/creators" },
  { id: "reviews", label: "Reviews & Reputation", href: "/admin/reviews" },
  { id: "settings", label: "Settings", href: "/admin/settings" },
];

// ─── Account Snapshot ─────────────────────────────────────────────────────────
export const accountSnapshot = {
  restaurantName: "Golden Wok – Downtown",
  accountOwner: "Kevin Zhang",
  activePlan: "Growth Retainer",
  currentFocus: "Conversion + Retention",
  nextReviewCall: "March 21, 2026",
  accountHealth: "Strong",
  recommendedNextStep: "Expand short-form content and improve drink upsell conversion",
};
