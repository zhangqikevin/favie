import type { InsertTaskDefinition } from "@shared/schema";

export const TASK_SEED: InsertTaskDefinition[] = [
  { id: "labor-compliance", title: "CA Labor Law Compliance Check", category: "Legal & HR", price: "1.99", shortDesc: "Current CA minimum wage, compliance checklist & accountant summary.", agentId: "legal" },
  { id: "employee-handbook", title: "Employee Handbook Generator", category: "Legal & HR", price: "19.99", shortDesc: "A full CA-compliant employee handbook with attendance, dress code, and tip policies.", agentId: "legal" },
  { id: "job-description", title: "Job Description Writer", category: "Legal & HR", price: "4.99", shortDesc: "Ready-to-post Indeed/Craigslist listing for any front- or back-of-house role.", agentId: "legal" },
  { id: "disciplinary-warning", title: "Disciplinary Warning Letter", category: "Legal & HR", price: "9.99", shortDesc: "Formal written warning that's CA-compliant and ready to sign.", agentId: "legal" },
  { id: "termination-checklist", title: "Termination Checklist", category: "Legal & HR", price: "7.99", shortDesc: "Step-by-step exit checklist covering final pay, COBRA, and equipment return.", agentId: "legal" },
  { id: "onboarding-schedule", title: "New Hire Onboarding Schedule", category: "Legal & HR", price: "6.99", shortDesc: "Two-week day-by-day onboarding plan for any restaurant role.", agentId: "legal" },

  { id: "food-cost-benchmark", title: "Food Cost Benchmark Report", category: "Finance", price: "9.99", shortDesc: "Compare your food cost % to LA restaurant averages with cut-the-cost action items.", agentId: "finance" },
  { id: "break-even-calculator", title: "Break-Even Calculator", category: "Finance", price: "4.99", shortDesc: "Break-even order count & revenue target with a sensitivity table.", agentId: "finance" },
  { id: "catering-quote", title: "Catering Quote Generator", category: "Finance", price: "4.99", shortDesc: "Professional per-head catering proposal with a service-fee breakdown.", agentId: "finance" },
  { id: "price-increase-letter", title: "Price Increase Notice", category: "Finance", price: "3.99", shortDesc: "Warm, honest customer-facing letter for menu price increases.", agentId: "finance" },
  { id: "dish-cost-card", title: "Dish Cost Card", category: "Finance", price: "4.99", shortDesc: "Ingredient-level cost card with food cost %, suggested retail price, and margin.", agentId: "finance" },

  { id: "review-reply", title: "Review Reply Templates", category: "Customer Service", price: "1.99", shortDesc: "Three ready-to-post replies (short / medium / full) for any negative review.", agentId: "customer" },
  { id: "faq-generator", title: "Restaurant FAQ Generator", category: "Customer Service", price: "3.99", shortDesc: "Customer-ready FAQ page covering reservations, parking, menu, and delivery.", agentId: "customer" },
  { id: "complaint-email", title: "Complaint Email Response", category: "Customer Service", price: "2.99", shortDesc: "Professional, empathetic email reply that turns a complaint into a return visit.", agentId: "customer" },
  { id: "reservation-policy", title: "Reservation Policy Writer", category: "Customer Service", price: "3.99", shortDesc: "Polished reservation & cancellation policy for your website and OpenTable.", agentId: "customer" },
  { id: "loyalty-program", title: "Loyalty Program Designer", category: "Customer Service", price: "7.99", shortDesc: "Points / stamp / tier loyalty program design with launch copy included.", agentId: "customer" },

  { id: "social-media-pack", title: "Social Media Content Pack", category: "Marketing", price: "9.99", shortDesc: "7-day Instagram + Facebook calendar with captions, hashtags, and post times.", agentId: "social" },
  { id: "google-business-optimizer", title: "Google Business Optimizer", category: "Marketing", price: "6.99", shortDesc: "Rewritten GBP description, attributes checklist, and post template pack.", agentId: "social" },
  { id: "monthly-newsletter", title: "Monthly Email Newsletter", category: "Marketing", price: "7.99", shortDesc: "Full newsletter with A/B subject lines, featured dish section, and a CTA.", agentId: "social" },
  { id: "grand-opening", title: "Grand Opening Announcement", category: "Marketing", price: "5.99", shortDesc: "Press-ready grand-opening copy for email, social media, and local press.", agentId: "social" },
  { id: "happy-hour-promo", title: "Happy Hour Promo Designer", category: "Marketing", price: "4.99", shortDesc: "Happy hour offer structure, in-store signage copy, and social announcement.", agentId: "social" },

  { id: "schedule-optimizer", title: "Schedule Optimizer", category: "Operations", price: "7.99", shortDesc: "Optimized weekly staff schedule with labor-cost estimate and overtime flags.", agentId: "operation" },
  { id: "open-close-checklist", title: "Opening & Closing Checklist", category: "Operations", price: "3.99", shortDesc: "Role-specific open and close checklists for FOH and BOH.", agentId: "operation" },
  { id: "health-inspection", title: "Health Inspection Prep Guide", category: "Operations", price: "5.99", shortDesc: "Room-by-room health inspection checklist with common violation fixes.", agentId: "operation" },
  { id: "vendor-rfq", title: "Vendor RFQ Template", category: "Operations", price: "3.99", shortDesc: "Professional Request for Quote email for food, beverage, or supply vendors.", agentId: "operation" },

  { id: "pricing-formula", title: "Revenue Pricing Formula", category: "Finance", price: "9.99", shortDesc: "4.8x pricing model + menu engineering matrix to set prices that hit your revenue target.", agentId: "finance" },

  { id: "pos-vendor-comparison", title: "POS & Vendor System Comparison", category: "Operations", price: "12.99", shortDesc: "Compare 10+ POS systems on pricing, features, and integration fit for your restaurant.", agentId: "operation" },
  { id: "labor-utilization", title: "Labor Utilization Analysis", category: "Operations", price: "11.99", shortDesc: "Hour-by-hour efficiency report with staffing adjustment recommendations.", agentId: "operation" },
  { id: "supplier-comparison", title: "Multi-Supplier Price Comparison", category: "Operations", price: "14.99", shortDesc: "Side-by-side vendor price analysis with negotiation tactics and switch savings estimate.", agentId: "operation" },
  { id: "channel-expansion", title: "Takeout & Banquet Expansion Plan", category: "Operations", price: "19.99", shortDesc: "Full playbook to grow your takeout and private dining revenue — with revenue projections.", agentId: "operation" },

  { id: "local-acquisition", title: "Local Demographic Acquisition Strategy", category: "Marketing", price: "14.99", shortDesc: "Hyper-local customer acquisition plan using neighborhood demographic and foot-traffic data.", agentId: "social" },

  { id: "lease-negotiation", title: "Lease Negotiation Package", category: "Legal & HR", price: "24.99", shortDesc: "Market-data-backed negotiation strategy with talking points and attorney checklist.", agentId: "legal" },

  { id: "menu-engineering", title: "Menu Engineering Analysis", category: "Chef", price: "14.99", shortDesc: "Star / Plow Horse / Puzzle / Dog matrix for every dish — with pricing recommendations.", agentId: "chef" },
  { id: "recipe-scaler", title: "Recipe Scaler", category: "Chef", price: "2.99", shortDesc: "Scale any recipe to any batch size with ingredient quantities and prep notes.", agentId: "chef" },
  { id: "seasonal-menu", title: "Seasonal Menu Planner", category: "Chef", price: "9.99", shortDesc: "5-dish seasonal menu concept with trend rationale and ingredient sourcing notes.", agentId: "chef" },
  { id: "allergen-audit", title: "Allergen Audit Report", category: "Chef", price: "6.99", shortDesc: "Big-9 allergen flag for every item + a customer-friendly allergen disclosure.", agentId: "chef" },
  { id: "staff-meal", title: "Staff Meal Planner", category: "Chef", price: "3.99", shortDesc: "Weekly staff meal plan using your surplus inventory — cost per meal included.", agentId: "chef" },
  { id: "menu-description", title: "Menu Description Writer", category: "Chef", price: "4.99", shortDesc: "Sensory, click-driving rewrites for up to 5 menu items.", agentId: "chef" },

  { id: "expert-hire", title: "Restaurant Expert — Monthly Subscription", category: "Expert", price: "999", shortDesc: "Unlimited access to the Restaurant Expert — no restrictions.", agentId: "expert" },
];
