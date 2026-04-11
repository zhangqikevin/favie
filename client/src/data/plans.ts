export interface AgentEntry {
  name: string;
  color: string;
  textColor: string;
  dotColor: string;
}

export interface Plan {
  id: string;
  agentCount: number;
  price: string;
  priceNum: number;
  tagline: string;
  desc: string;
  comboLabel: string;
  includes: AgentEntry[];
  bullets: string[];
  popular: boolean;
}

export const plans: Plan[] = [
  {
    id: "agent-1",
    agentCount: 1,
    price: "$199",
    priceNum: 199,
    tagline: "Good for getting started",
    desc: "Perfect for businesses getting started with AI operations.",
    comboLabel: "Start with what drives the most revenue — your delivery channel.",
    includes: [
      { name: "Operation Agent", color: "bg-blue-600", textColor: "text-blue-700", dotColor: "bg-blue-600" },
    ],
    bullets: [
      "Delivery platform ad management",
      "Storefront visibility optimization",
      "Menu structure & upsell strategy",
      "Monthly performance reporting",
    ],
    popular: false,
  },
  {
    id: "agent-2",
    agentCount: 2,
    price: "$299",
    priceNum: 299,
    tagline: "Great for small teams",
    desc: "A great setup for handling multiple recurring workflows.",
    comboLabel: "Delivery performance and menu quality, working in sync.",
    includes: [
      { name: "Operation Agent", color: "bg-blue-600", textColor: "text-blue-700", dotColor: "bg-blue-600" },
      { name: "Chef Agent", color: "bg-amber-500", textColor: "text-amber-700", dotColor: "bg-amber-500" },
    ],
    bullets: [
      "Everything in 1-Agent setup",
      "Menu audit & new dish ideation",
      "Food photo & description upgrades",
      "Bundle and combo design",
    ],
    popular: false,
  },
  {
    id: "agent-3",
    agentCount: 3,
    price: "$399",
    priceNum: 399,
    tagline: "Ideal for growing operations",
    desc: "Ideal for growing teams that need broader AI support.",
    comboLabel: "Delivery, menu, and social presence — the core growth triangle.",
    includes: [
      { name: "Operation Agent", color: "bg-blue-600", textColor: "text-blue-700", dotColor: "bg-blue-600" },
      { name: "Chef Agent", color: "bg-amber-500", textColor: "text-amber-700", dotColor: "bg-amber-500" },
      { name: "Social Agent", color: "bg-purple-600", textColor: "text-purple-700", dotColor: "bg-purple-600" },
    ],
    bullets: [
      "Everything in 2-Agent setup",
      "Social content calendar & publishing",
      "Short-form video scripts",
      "Influencer coordination",
    ],
    popular: true,
  },
  {
    id: "agent-4",
    agentCount: 4,
    price: "$459",
    priceNum: 459,
    tagline: "Best for multi-task workflows",
    desc: "Best for businesses running multiple AI-powered operations at once.",
    comboLabel: "Every growth channel, fully managed. Nothing falls through the cracks.",
    includes: [
      { name: "Operation Agent", color: "bg-blue-600", textColor: "text-blue-700", dotColor: "bg-blue-600" },
      { name: "Chef Agent", color: "bg-amber-500", textColor: "text-amber-700", dotColor: "bg-amber-500" },
      { name: "Social Agent", color: "bg-purple-600", textColor: "text-purple-700", dotColor: "bg-purple-600" },
      { name: "Customer Agent", color: "bg-teal-600", textColor: "text-teal-700", dotColor: "bg-teal-600" },
    ],
    bullets: [
      "Everything in 3-Agent setup",
      "Review monitoring & response",
      "Loyalty program design",
      "Guest reactivation campaigns",
    ],
    popular: false,
  },
];
