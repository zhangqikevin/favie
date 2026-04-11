import { Target, LayoutGrid, Globe, Users2, ShieldCheck, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Service {
  slug: string;
  shortTitle: string;
  fullTitle: string;
  tagline: string;
  positioning: string;
  problem: string;
  whatWeDo: string[];
  impact: string[];
  ctaText: string;
  icon: LucideIcon;
  color: string;
  heroImage: string;
}

export const services: Service[] = [
  {
    slug: "delivery-optimization",
    shortTitle: "Delivery Optimization",
    fullTitle: "Delivery Platform Optimization & Advertising",
    tagline: "Be Found First. Convert Every Click.",
    positioning: "We manage paid visibility and storefront presentation on delivery platforms so your restaurant reaches more customers and converts more of them.",
    problem:
      "Most restaurants run on delivery platforms without any paid visibility strategy. Your storefront listing — photos, description, item order — is often unoptimized, costing you clicks and orders you should already be winning.",
    whatWeDo: [
      "Paid ad campaign setup and management on DoorDash and Uber Eats",
      "Storefront photo and copy optimization to improve click-through rate",
      "Category tagging and search keyword positioning",
      "Promotional pricing strategy and campaign execution",
      "Regular listing audits and performance-based adjustments",
    ],
    impact: [
      "Higher placement in platform search and category results",
      "Improved click-through rate on your listing",
      "Lower cost per incremental order from paid ads",
      "Stronger first impression that converts browsers into buyers",
    ],
    ctaText: "Request a storefront audit",
    icon: Target,
    color: "bg-primary/10 text-primary",
    heroImage: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=1000&q=72",
  },
  {
    slug: "menu-improving",
    shortTitle: "Menu Improving",
    fullTitle: "Menu, Bundle & Upsell Optimization",
    tagline: "Turn Every Order Into a Bigger Order.",
    positioning: "We restructure your menu to drive higher average order value — through better item presentation, strategic bundling, and targeted upsell placement.",
    problem:
      "Most restaurant menus are organized for the kitchen, not the customer. Poor item presentation, weak descriptions, and no bundling strategy means guests order less than they would with better prompts.",
    whatWeDo: [
      "Menu architecture audit and restructure for revenue flow",
      "Item title and description copywriting for appetite appeal and clarity",
      "Bundle and combo design to increase average order value",
      "Upsell trigger placement at key ordering decision points",
      "Ongoing testing and performance tracking by item and category",
    ],
    impact: [
      "Measurable increase in average order value",
      "Higher attachment rate on profitable add-ons",
      "Better discovery and ordering of high-margin items",
      "Reduced decision friction for guests browsing the menu",
    ],
    ctaText: "Get a menu review",
    icon: LayoutGrid,
    color: "bg-secondary/20 text-secondary",
    heroImage: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=1000&q=72",
  },
  {
    slug: "social-media-operation",
    shortTitle: "Social Media Operation",
    fullTitle: "Social Media Operation & Short-Form Video",
    tagline: "Consistent Presence. Viral-Ready Content.",
    positioning: "We build and manage your full social media presence — from daily content and community management to short-form video strategy and production direction — so your brand stays active, relevant, and conversion-ready.",
    problem:
      "Most restaurant social accounts post inconsistently, lack a defined brand voice, and have no short-form video strategy. The result is low engagement, no follower growth, and no meaningful connection to sales — even as TikTok and Reels deliver the highest organic reach available.",
    whatWeDo: [
      "Monthly content calendar aligned to brand voice and business calendar",
      "Post creation including photography direction and caption writing",
      "Scheduling and platform-native publishing across Instagram, Facebook, and TikTok",
      "Community management including comment responses and DM handling",
      "Short-form video concept development and script writing for TikTok, Reels, and YouTube Shorts",
      "Shot list and production direction guide for efficient filming",
      "Content batching strategy to maximize output per shoot session",
      "Monthly performance reporting with engagement, reach, and video metrics",
    ],
    impact: [
      "Consistent brand presence across active social platforms",
      "Organic audience growth and improved follower quality",
      "Higher engagement rate per post",
      "Short-form content that reaches beyond your existing follower base",
      "Higher watch time and share rate versus static posts",
      "Brand authority that converts followers into first-time visitors",
    ],
    ctaText: "See how we build your presence",
    icon: Globe,
    color: "bg-blue-500/10 text-blue-600",
    heroImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&q=72",
  },
  {
    slug: "social-influencer-collaboration",
    shortTitle: "Social Influencer Collaboration",
    fullTitle: "Social Influencer Collaboration",
    tagline: "Reach New Customers Through Trusted Voices.",
    positioning: "We identify, brief, and manage creator collaborations so your restaurant reaches new audiences efficiently — without wasting budget on low-fit partnerships.",
    problem:
      "Organic reach on social platforms is limited. Reaching new audiences cost-effectively requires trusted third-party voices — but managing influencer and creator relationships without the right framework wastes budget and produces low ROI.",
    whatWeDo: [
      "Influencer and creator identification based on audience fit and engagement quality",
      "Campaign briefing and collaboration negotiation",
      "Content approval and brand alignment review",
      "Campaign execution management and timeline tracking",
      "Performance measurement: reach, engagement, and incremental traffic",
    ],
    impact: [
      "Faster audience reach beyond your existing follower base",
      "Trust-based brand introduction to new customer segments",
      "Higher conversion from creator-driven trial versus direct advertising",
      "Managed budget efficiency across the full collaboration lifecycle",
    ],
    ctaText: "Talk to us about collaborations",
    icon: Users2,
    color: "bg-purple-500/10 text-purple-600",
    heroImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&q=72",
  },
  {
    slug: "reviews-reputation-boost",
    shortTitle: "Reviews & Reputation Boost",
    fullTitle: "Reviews, Engagement & Reputation Boost",
    tagline: "A Strong Reputation Is a Growth Asset.",
    positioning: "We build and protect your restaurant's public reputation — across delivery platforms, review sites, and social channels — so your ratings become a driver of conversion.",
    problem:
      "Negative reviews go unanswered. Response quality is inconsistent. Restaurants rarely have a systematic approach to building review volume. The result is a reputation that underperforms the actual quality of the business.",
    whatWeDo: [
      "Review monitoring across delivery platforms and public review sites",
      "Response writing in brand voice for both positive and critical reviews",
      "Strategy for ethically increasing review volume from satisfied guests",
      "Delivery platform rating management and escalation handling",
      "Monthly reputation reporting with trend analysis",
    ],
    impact: [
      "Higher average rating over time across all platforms",
      "Faster response rate that reduces reputation risk from unresolved complaints",
      "Improved customer trust and platform conversion rate",
      "A systematic reputation asset that supports all other growth channels",
    ],
    ctaText: "Get a reputation audit",
    icon: ShieldCheck,
    color: "bg-green-500/10 text-green-600",
    heroImage: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1000&q=72",
  },
  {
    slug: "loyalty-program",
    shortTitle: "Loyalty Program",
    fullTitle: "Loyalty Program & Member Retention",
    tagline: "Your Best Growth Comes From Guests You Already Have.",
    positioning: "We build the loyalty and retention infrastructure your restaurant needs to bring back lapsed guests, increase repeat purchase frequency, and improve customer lifetime value.",
    problem:
      "Acquisition is expensive. Most restaurant businesses do not have a structured loyalty program or systematic approach to bringing back lapsed guests, activating their existing customer base, or driving repeatable purchase behavior.",
    whatWeDo: [
      "Loyalty program design and setup tailored to your restaurant model",
      "Guest data segmentation by recency, frequency, and spend level",
      "Reactivation campaign development targeting lapsed customer cohorts",
      "Loyalty trigger design and promotional cadence planning",
      "CRM and messaging platform setup and management",
      "Performance tracking by campaign: reactivation rate, incremental orders, and ROI",
    ],
    impact: [
      "Measurable reactivation of guests who have stopped ordering",
      "Higher repeat purchase rate across your active customer base",
      "Improved customer lifetime value without increasing acquisition spend",
      "A retention infrastructure that compounds value over time",
    ],
    ctaText: "Discuss your loyalty strategy",
    icon: Gift,
    color: "bg-rose-500/10 text-rose-600",
    heroImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1000&q=72",
  },
];

export function getServiceBySlug(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}
