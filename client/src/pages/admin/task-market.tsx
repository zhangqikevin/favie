import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  ShoppingBag, Scale, TrendingUp, BookOpen,
  Star, Instagram, Calendar, Loader2, Play, ArrowLeft,
  FileText, PenLine, AlertTriangle, ClipboardList, GraduationCap,
  Calculator, FileSpreadsheet, Megaphone, Receipt,
  FlaskConical, Leaf, ShieldAlert, UtensilsCrossed, Sparkles,
  HelpCircle, MailOpen, CalendarCheck, Gift,
  MapPin, Newspaper, Rocket, Percent,
  ListChecks, ClipboardCheck, Package,
  CreditCard, Lock, CheckCircle2, X,
  Monitor, BarChart2, Truck, Building2, Users,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TaskField {
  id: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
  rows?: number;
}

interface Task {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  shortDesc: string;
  icon: typeof Scale;
  color: string;
  bg: string;
  fields: TaskField[];
  agentId?: string;
}

function useTasks(): Task[] {
  const { t } = useTranslation();
  return [
    {
      id: "labor-compliance",
      title: t("task_market.task_labor_compliance_title"),
      price: 1.99,
      category: t("task_market.cat_legal_hr"),
      agentId: "legal",
      shortDesc: t("task_market.task_labor_compliance_short"),
      description: t("task_market.task_labor_compliance_desc"),
      icon: Scale,
      color: "text-violet-600",
      bg: "bg-violet-50",
      fields: [
        { id: "employeeCount", label: t("task_market.field_employee_count"), type: "number", placeholder: t("task_market.ph_employee_count") },
        {
          id: "hasTippedWorkers",
          label: t("task_market.field_has_tipped_workers"),
          type: "select",
          options: [
            { label: t("task_market.opt_yes"), value: "true" },
            { label: t("task_market.opt_no"), value: "false" },
          ],
        },
      ],
    },
    {
      id: "employee-handbook",
      title: t("task_market.task_employee_handbook_title"),
      price: 19.99,
      category: t("task_market.cat_legal_hr"),
      agentId: "legal",
      shortDesc: t("task_market.task_employee_handbook_short"),
      description: t("task_market.task_employee_handbook_desc"),
      icon: FileText,
      color: "text-violet-600",
      bg: "bg-violet-50",
      fields: [
        { id: "restaurantName", label: t("task_market.field_restaurant_name"), type: "text", placeholder: t("task_market.ph_restaurant_name") },
        { id: "employeeCount", label: t("task_market.field_num_employees"), type: "number", placeholder: t("task_market.ph_employee_count") },
        {
          id: "serviceType",
          label: t("task_market.field_service_type"),
          type: "select",
          options: [
            { label: t("task_market.opt_dine_in_only"), value: "dine-in only" },
            { label: t("task_market.opt_delivery_only"), value: "delivery only" },
            { label: t("task_market.opt_both_dine_delivery"), value: "both dine-in and delivery" },
          ],
        },
      ],
    },
    {
      id: "job-description",
      title: t("task_market.task_job_description_title"),
      price: 2.99,
      category: t("task_market.cat_legal_hr"),
      agentId: "legal",
      shortDesc: t("task_market.task_job_description_short"),
      description: t("task_market.task_job_description_desc"),
      icon: PenLine,
      color: "text-violet-600",
      bg: "bg-violet-50",
      fields: [
        { id: "jobTitle", label: t("task_market.field_job_title"), type: "text", placeholder: t("task_market.ph_job_title") },
        {
          id: "responsibilities",
          label: t("task_market.field_responsibilities"),
          type: "textarea",
          placeholder: t("task_market.ph_responsibilities"),
          rows: 4,
        },
        { id: "salaryRange", label: t("task_market.field_salary_range"), type: "text", placeholder: t("task_market.ph_salary_range") },
      ],
    },
    {
      id: "disciplinary-warning",
      title: t("task_market.task_disciplinary_warning_title"),
      price: 3.99,
      category: t("task_market.cat_legal_hr"),
      agentId: "legal",
      shortDesc: t("task_market.task_disciplinary_warning_short"),
      description: t("task_market.task_disciplinary_warning_desc"),
      icon: AlertTriangle,
      color: "text-violet-600",
      bg: "bg-violet-50",
      fields: [
        { id: "employeeName", label: t("task_market.field_employee_name"), type: "text", placeholder: t("task_market.ph_employee_name") },
        {
          id: "violation",
          label: t("task_market.field_violation"),
          type: "textarea",
          placeholder: t("task_market.ph_violation"),
          rows: 4,
        },
        {
          id: "priorWarnings",
          label: t("task_market.field_prior_warnings"),
          type: "select",
          options: [
            { label: t("task_market.opt_no_prior_warnings"), value: "no prior warnings — this is the first offense" },
            { label: t("task_market.opt_one_verbal_warning"), value: "one prior verbal warning" },
            { label: t("task_market.opt_one_written_warning"), value: "one prior written warning" },
            { label: t("task_market.opt_multiple_warnings"), value: "multiple prior warnings" },
          ],
        },
      ],
    },
    {
      id: "termination-checklist",
      title: t("task_market.task_termination_checklist_title"),
      price: 4.99,
      category: t("task_market.cat_legal_hr"),
      agentId: "legal",
      shortDesc: t("task_market.task_termination_checklist_short"),
      description: t("task_market.task_termination_checklist_desc"),
      icon: ClipboardList,
      color: "text-violet-600",
      bg: "bg-violet-50",
      fields: [
        {
          id: "terminationType",
          label: t("task_market.field_termination_type"),
          type: "select",
          options: [
            { label: t("task_market.opt_involuntary"), value: "involuntary (fired or laid off)" },
            { label: t("task_market.opt_voluntary"), value: "voluntary resignation" },
          ],
        },
        {
          id: "employeeType",
          label: t("task_market.field_employee_type"),
          type: "select",
          options: [
            { label: t("task_market.opt_full_time"), value: "full-time" },
            { label: t("task_market.opt_part_time"), value: "part-time" },
            { label: t("task_market.opt_tipped_employee"), value: "tipped employee" },
            { label: t("task_market.opt_seasonal"), value: "seasonal or temporary" },
          ],
        },
      ],
    },
    {
      id: "onboarding-schedule",
      title: t("task_market.task_onboarding_schedule_title"),
      price: 4.99,
      category: t("task_market.cat_legal_hr"),
      agentId: "legal",
      shortDesc: t("task_market.task_onboarding_schedule_short"),
      description: t("task_market.task_onboarding_schedule_desc"),
      icon: GraduationCap,
      color: "text-violet-600",
      bg: "bg-violet-50",
      fields: [
        { id: "position", label: t("task_market.field_position"), type: "text", placeholder: t("task_market.ph_position") },
        {
          id: "department",
          label: t("task_market.field_department"),
          type: "select",
          options: [
            { label: t("task_market.opt_front_of_house"), value: "front of house" },
            { label: t("task_market.opt_back_of_house"), value: "back of house / kitchen" },
            { label: t("task_market.opt_management"), value: "management" },
          ],
        },
        { id: "startDate", label: t("task_market.field_start_date"), type: "text", placeholder: t("task_market.ph_start_date") },
      ],
    },
    {
      id: "food-cost-benchmark",
      title: t("task_market.task_food_cost_benchmark_title"),
      price: 4.99,
      category: t("task_market.cat_finance"),
      agentId: "finance",
      shortDesc: t("task_market.task_food_cost_benchmark_short"),
      description: t("task_market.task_food_cost_benchmark_desc"),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      fields: [
        { id: "foodCostPct", label: t("task_market.field_food_cost_pct"), type: "number", placeholder: t("task_market.ph_food_cost_pct") },
        {
          id: "monthlyRevenue",
          label: t("task_market.field_monthly_revenue"),
          type: "select",
          options: [
            { label: t("task_market.opt_rev_under_30k"), value: "under $30,000" },
            { label: t("task_market.opt_rev_30_60k"), value: "$30,000–$60,000" },
            { label: t("task_market.opt_rev_60_100k"), value: "$60,000–$100,000" },
            { label: t("task_market.opt_rev_100_200k"), value: "$100,000–$200,000" },
            { label: t("task_market.opt_rev_over_200k"), value: "over $200,000" },
          ],
        },
      ],
    },
    {
      id: "break-even",
      title: t("task_market.task_break_even_title"),
      price: 4.99,
      category: t("task_market.cat_finance"),
      agentId: "finance",
      shortDesc: t("task_market.task_break_even_short"),
      description: t("task_market.task_break_even_desc"),
      icon: Calculator,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      fields: [
        { id: "monthlyRent", label: t("task_market.field_monthly_rent"), type: "text", placeholder: t("task_market.ph_monthly_rent") },
        { id: "monthlyLabor", label: t("task_market.field_monthly_labor"), type: "text", placeholder: t("task_market.ph_monthly_labor") },
        { id: "foodCostPct", label: t("task_market.field_food_cost_pct"), type: "number", placeholder: t("task_market.ph_food_cost_pct_30") },
        { id: "avgCheck", label: t("task_market.field_avg_check_after_tax"), type: "text", placeholder: t("task_market.ph_avg_check") },
      ],
    },
    {
      id: "catering-quote",
      title: t("task_market.task_catering_quote_title"),
      price: 9.99,
      category: t("task_market.cat_finance"),
      agentId: "finance",
      shortDesc: t("task_market.task_catering_quote_short"),
      description: t("task_market.task_catering_quote_desc"),
      icon: FileSpreadsheet,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      fields: [
        { id: "guestCount", label: t("task_market.field_guest_count"), type: "number", placeholder: t("task_market.ph_guest_count") },
        {
          id: "menuStyle",
          label: t("task_market.field_menu_style"),
          type: "select",
          options: [
            { label: t("task_market.opt_buffet"), value: "buffet" },
            { label: t("task_market.opt_plated"), value: "plated sit-down" },
            { label: t("task_market.opt_heavy_apps"), value: "heavy appetizers / cocktail style" },
            { label: t("task_market.opt_box_lunch"), value: "box lunch drop-off" },
          ],
        },
        { id: "menuDetails", label: t("task_market.field_menu_details"), type: "textarea", placeholder: t("task_market.ph_menu_details"), rows: 3 },
        { id: "budgetPerHead", label: t("task_market.field_budget_per_head"), type: "text", placeholder: t("task_market.ph_budget_per_head") },
      ],
    },
    {
      id: "price-increase-letter",
      title: t("task_market.task_price_increase_title"),
      price: 2.99,
      category: t("task_market.cat_finance"),
      agentId: "finance",
      shortDesc: t("task_market.task_price_increase_short"),
      description: t("task_market.task_price_increase_desc"),
      icon: Megaphone,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      fields: [
        { id: "increaseAmount", label: t("task_market.field_increase_amount"), type: "text", placeholder: t("task_market.ph_increase_amount") },
        {
          id: "reasons",
          label: t("task_market.field_increase_reasons"),
          type: "select",
          options: [
            { label: t("task_market.opt_rising_ingredient"), value: "rising ingredient and food costs" },
            { label: t("task_market.opt_rent_utility"), value: "rent and utility cost increases" },
            { label: t("task_market.opt_higher_wage"), value: "California minimum wage increases and higher labor costs" },
            { label: t("task_market.opt_all_above"), value: "rising ingredient costs, higher rent, and California minimum wage increases" },
          ],
        },
        {
          id: "restaurantStyle",
          label: t("task_market.field_restaurant_style"),
          type: "select",
          options: [
            { label: t("task_market.opt_casual_friendly"), value: "casual and friendly" },
            { label: t("task_market.opt_warm_family"), value: "warm and family-oriented" },
            { label: t("task_market.opt_professional_upscale"), value: "professional and upscale" },
          ],
        },
      ],
    },
    {
      id: "dish-cost-card",
      title: t("task_market.task_dish_cost_card_title"),
      price: 6.99,
      category: t("task_market.cat_finance"),
      agentId: "finance",
      shortDesc: t("task_market.task_dish_cost_card_short"),
      description: t("task_market.task_dish_cost_card_desc"),
      icon: Receipt,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      fields: [
        { id: "dishName", label: t("task_market.field_dish_name"), type: "text", placeholder: t("task_market.ph_dish_name") },
        {
          id: "ingredients",
          label: t("task_market.field_ingredients"),
          type: "textarea",
          placeholder: t("task_market.ph_ingredients"),
          rows: 8,
          description: t("task_market.desc_ingredients"),
        },
        { id: "currentPrice", label: t("task_market.field_current_price_optional"), type: "text", placeholder: t("task_market.ph_current_price") },
      ],
    },
    {
      id: "menu-engineering",
      title: t("task_market.task_menu_engineering_title"),
      price: 14.99,
      category: t("task_market.cat_chef"),
      agentId: "chef",
      shortDesc: t("task_market.task_menu_engineering_short"),
      description: t("task_market.task_menu_engineering_desc"),
      icon: BookOpen,
      color: "text-amber-600",
      bg: "bg-amber-50",
      fields: [
        {
          id: "menuText",
          label: t("task_market.field_menu_text"),
          type: "textarea",
          placeholder: t("task_market.ph_menu_text"),
          rows: 10,
          description: t("task_market.desc_menu_text"),
        },
      ],
    },
    {
      id: "review-reply",
      title: t("task_market.task_review_reply_title"),
      price: 1.99,
      category: t("task_market.cat_customer_service"),
      agentId: "customer",
      shortDesc: t("task_market.task_review_reply_short"),
      description: t("task_market.task_review_reply_desc"),
      icon: Star,
      color: "text-purple-600",
      bg: "bg-purple-50",
      fields: [
        {
          id: "reviewText",
          label: t("task_market.field_review_text"),
          type: "textarea",
          placeholder: t("task_market.ph_review_text"),
          rows: 5,
        },
        {
          id: "tone",
          label: t("task_market.field_reply_tone"),
          type: "select",
          options: [
            { label: t("task_market.opt_warm_empathetic"), value: "warm and empathetic" },
            { label: t("task_market.opt_professional_formal"), value: "professional and formal" },
            { label: t("task_market.opt_brief_direct"), value: "brief and direct" },
          ],
        },
      ],
    },
    {
      id: "faq-generator",
      title: t("task_market.task_faq_generator_title"),
      price: 4.99,
      category: t("task_market.cat_customer_service"),
      agentId: "customer",
      shortDesc: t("task_market.task_faq_generator_short"),
      description: t("task_market.task_faq_generator_desc"),
      icon: HelpCircle,
      color: "text-purple-600",
      bg: "bg-purple-50",
      fields: [
        {
          id: "restaurantType",
          label: t("task_market.field_restaurant_type"),
          type: "text",
          placeholder: t("task_market.ph_restaurant_type"),
        },
        {
          id: "faqTopics",
          label: t("task_market.field_faq_topics"),
          type: "select",
          options: [
            { label: t("task_market.opt_faq_reservations"), value: "reservations, wait times, and walk-ins" },
            { label: t("task_market.opt_faq_parking"), value: "parking, public transit, and accessibility" },
            { label: t("task_market.opt_faq_delivery"), value: "delivery, takeout, and online ordering" },
            { label: t("task_market.opt_faq_dietary"), value: "dietary restrictions, allergens, and special requests" },
            { label: t("task_market.opt_faq_all"), value: "reservations, parking, delivery, dietary needs, allergens, private events, and gift cards" },
          ],
        },
      ],
    },
    {
      id: "complaint-email",
      title: t("task_market.task_complaint_email_title"),
      price: 1.99,
      category: t("task_market.cat_customer_service"),
      agentId: "customer",
      shortDesc: t("task_market.task_complaint_email_short"),
      description: t("task_market.task_complaint_email_desc"),
      icon: MailOpen,
      color: "text-purple-600",
      bg: "bg-purple-50",
      fields: [
        {
          id: "complaintText",
          label: t("task_market.field_complaint_text"),
          type: "textarea",
          placeholder: t("task_market.ph_complaint_text"),
          rows: 5,
        },
        {
          id: "ourSideOfStory",
          label: t("task_market.field_our_side"),
          type: "textarea",
          placeholder: t("task_market.ph_our_side"),
          rows: 3,
        },
      ],
    },
    {
      id: "reservation-policy",
      title: t("task_market.task_reservation_policy_title"),
      price: 3.99,
      category: t("task_market.cat_customer_service"),
      agentId: "customer",
      shortDesc: t("task_market.task_reservation_policy_short"),
      description: t("task_market.task_reservation_policy_desc"),
      icon: CalendarCheck,
      color: "text-purple-600",
      bg: "bg-purple-50",
      fields: [
        {
          id: "acceptsReservations",
          label: t("task_market.field_accepts_reservations"),
          type: "select",
          options: [
            { label: t("task_market.opt_res_phone_online"), value: "yes, by phone and online booking" },
            { label: t("task_market.opt_res_phone_only"), value: "yes, by phone only" },
            { label: t("task_market.opt_res_walk_in"), value: "walk-in only — we do not take reservations" },
            { label: t("task_market.opt_res_large_parties"), value: "reservations for parties of 6 or more only" },
          ],
        },
        { id: "maxPartySize", label: t("task_market.field_max_party_size"), type: "text", placeholder: t("task_market.ph_max_party_size") },
        {
          id: "noShowPolicy",
          label: t("task_market.field_no_show_policy"),
          type: "select",
          options: [
            { label: t("task_market.opt_no_charge_flexible"), value: "no charge, we're flexible" },
            { label: t("task_market.opt_deposit_forfeited"), value: "$25 deposit forfeited if cancelled with less than 24 hours notice" },
            { label: t("task_market.opt_cc_required"), value: "credit card required at booking; charged $15/person for no-shows" },
          ],
        },
      ],
    },
    {
      id: "loyalty-program",
      title: t("task_market.task_loyalty_program_title"),
      price: 6.99,
      category: t("task_market.cat_customer_service"),
      agentId: "customer",
      shortDesc: t("task_market.task_loyalty_program_short"),
      description: t("task_market.task_loyalty_program_desc"),
      icon: Gift,
      color: "text-purple-600",
      bg: "bg-purple-50",
      fields: [
        { id: "avgCheck", label: t("task_market.field_avg_check_guest"), type: "text", placeholder: t("task_market.ph_avg_check_guest") },
        {
          id: "repeatGoal",
          label: t("task_market.field_repeat_goal"),
          type: "select",
          options: [
            { label: t("task_market.opt_once_month"), value: "once a month" },
            { label: t("task_market.opt_2_3_month"), value: "2-3 times per month" },
            { label: t("task_market.opt_once_week"), value: "once a week" },
          ],
        },
        { id: "rewardBudget", label: t("task_market.field_reward_budget"), type: "text", placeholder: t("task_market.ph_reward_budget") },
      ],
    },
    {
      id: "social-media-pack",
      title: t("task_market.task_social_media_pack_title"),
      price: 9.99,
      category: t("task_market.cat_marketing"),
      agentId: "social",
      shortDesc: t("task_market.task_social_media_pack_short"),
      description: t("task_market.task_social_media_pack_desc"),
      icon: Instagram,
      color: "text-pink-600",
      bg: "bg-pink-50",
      fields: [
        {
          id: "featuredDishes",
          label: t("task_market.field_featured_dishes"),
          type: "text",
          placeholder: t("task_market.ph_featured_dishes"),
        },
        {
          id: "weeklyEvents",
          label: t("task_market.field_weekly_events"),
          type: "textarea",
          placeholder: t("task_market.ph_weekly_events"),
          rows: 3,
        },
      ],
    },
    {
      id: "gbp-optimizer",
      title: t("task_market.task_gbp_optimizer_title"),
      price: 3.99,
      category: t("task_market.cat_marketing"),
      agentId: "social",
      shortDesc: t("task_market.task_gbp_optimizer_short"),
      description: t("task_market.task_gbp_optimizer_desc"),
      icon: MapPin,
      color: "text-pink-600",
      bg: "bg-pink-50",
      fields: [
        { id: "restaurantDesc", label: t("task_market.field_restaurant_desc"), type: "textarea", placeholder: t("task_market.ph_restaurant_desc"), rows: 3 },
        { id: "specialties", label: t("task_market.field_specialties"), type: "text", placeholder: t("task_market.ph_specialties") },
        { id: "neighborhood", label: t("task_market.field_neighborhood"), type: "text", placeholder: t("task_market.ph_neighborhood") },
      ],
    },
    {
      id: "email-newsletter",
      title: t("task_market.task_email_newsletter_title"),
      price: 6.99,
      category: t("task_market.cat_marketing"),
      agentId: "social",
      shortDesc: t("task_market.task_email_newsletter_short"),
      description: t("task_market.task_email_newsletter_desc"),
      icon: Newspaper,
      color: "text-pink-600",
      bg: "bg-pink-50",
      fields: [
        { id: "newDishes", label: t("task_market.field_new_dishes"), type: "text", placeholder: t("task_market.ph_new_dishes") },
        { id: "events", label: t("task_market.field_events_month"), type: "textarea", placeholder: t("task_market.ph_events_month"), rows: 3 },
        { id: "storyContent", label: t("task_market.field_story_content"), type: "textarea", placeholder: t("task_market.ph_story_content"), rows: 3 },
      ],
    },
    {
      id: "grand-opening",
      title: t("task_market.task_grand_opening_title"),
      price: 4.99,
      category: t("task_market.cat_marketing"),
      agentId: "social",
      shortDesc: t("task_market.task_grand_opening_short"),
      description: t("task_market.task_grand_opening_desc"),
      icon: Rocket,
      color: "text-pink-600",
      bg: "bg-pink-50",
      fields: [
        { id: "openingDate", label: t("task_market.field_opening_date"), type: "text", placeholder: t("task_market.ph_opening_date") },
        { id: "address", label: t("task_market.field_address"), type: "text", placeholder: t("task_market.ph_address") },
        { id: "keyPoints", label: t("task_market.field_key_points"), type: "textarea", placeholder: t("task_market.ph_key_points"), rows: 4 },
      ],
    },
    {
      id: "promo-designer",
      title: t("task_market.task_promo_designer_title"),
      price: 4.99,
      category: t("task_market.cat_marketing"),
      agentId: "social",
      shortDesc: t("task_market.task_promo_designer_short"),
      description: t("task_market.task_promo_designer_desc"),
      icon: Percent,
      color: "text-pink-600",
      bg: "bg-pink-50",
      fields: [
        { id: "timeSlot", label: t("task_market.field_time_slot"), type: "text", placeholder: t("task_market.ph_time_slot") },
        {
          id: "promoGoal",
          label: t("task_market.field_promo_goal"),
          type: "select",
          options: [
            { label: t("task_market.opt_drive_traffic"), value: "drive more foot traffic during slow hours" },
            { label: t("task_market.opt_move_inventory"), value: "move excess inventory and reduce food waste" },
            { label: t("task_market.opt_bring_back_customers"), value: "re-engage lapsed customers and boost repeat visits" },
            { label: t("task_market.opt_increase_check"), value: "increase average check size through upsells" },
          ],
        },
      ],
    },
    {
      id: "schedule-optimizer",
      title: t("task_market.task_schedule_optimizer_title"),
      price: 4.99,
      category: t("task_market.cat_operations"),
      agentId: "operation",
      shortDesc: t("task_market.task_schedule_optimizer_short"),
      description: t("task_market.task_schedule_optimizer_desc"),
      icon: Calendar,
      color: "text-teal-600",
      bg: "bg-teal-50",
      fields: [
        {
          id: "teamInfo",
          label: t("task_market.field_team_size_roles"),
          type: "textarea",
          placeholder: t("task_market.ph_team_size_roles"),
          rows: 3,
          description: t("task_market.desc_team_size_roles"),
        },
        {
          id: "operatingHours",
          label: t("task_market.field_operating_hours"),
          type: "text",
          placeholder: t("task_market.ph_operating_hours"),
        },
        {
          id: "peakHours",
          label: t("task_market.field_peak_hours"),
          type: "text",
          placeholder: t("task_market.ph_peak_hours"),
        },
      ],
    },
    {
      id: "open-close-checklist",
      title: t("task_market.task_open_close_checklist_title"),
      price: 4.99,
      category: t("task_market.cat_operations"),
      agentId: "operation",
      shortDesc: t("task_market.task_open_close_checklist_short"),
      description: t("task_market.task_open_close_checklist_desc"),
      icon: ListChecks,
      color: "text-teal-600",
      bg: "bg-teal-50",
      fields: [
        {
          id: "restaurantType",
          label: t("task_market.field_restaurant_type"),
          type: "select",
          options: [
            { label: t("task_market.opt_full_service_casual"), value: "full-service casual dining" },
            { label: t("task_market.opt_fine_dining"), value: "fine dining" },
            { label: t("task_market.opt_fast_casual"), value: "fast casual or counter service" },
            { label: t("task_market.opt_cafe"), value: "café or coffee shop" },
            { label: t("task_market.opt_bar"), value: "bar or gastropub" },
          ],
        },
        {
          id: "staffRoles",
          label: t("task_market.field_staff_roles"),
          type: "textarea",
          placeholder: t("task_market.ph_staff_roles"),
          rows: 2,
        },
      ],
    },
    {
      id: "health-inspection",
      title: t("task_market.task_health_inspection_title"),
      price: 6.99,
      category: t("task_market.cat_operations"),
      agentId: "operation",
      shortDesc: t("task_market.task_health_inspection_short"),
      description: t("task_market.task_health_inspection_desc"),
      icon: ClipboardCheck,
      color: "text-teal-600",
      bg: "bg-teal-50",
      fields: [
        { id: "city", label: t("task_market.field_city_county"), type: "text", placeholder: t("task_market.ph_city_county") },
        {
          id: "restaurantType",
          label: t("task_market.field_restaurant_type"),
          type: "select",
          options: [
            { label: t("task_market.opt_full_service_dining"), value: "full-service dining" },
            { label: t("task_market.opt_fast_casual"), value: "fast casual or counter service" },
            { label: t("task_market.opt_food_truck"), value: "food truck" },
            { label: t("task_market.opt_bakery_cafe"), value: "bakery or café" },
          ],
        },
        {
          id: "previousIssues",
          label: t("task_market.field_previous_issues"),
          type: "textarea",
          placeholder: t("task_market.ph_previous_issues"),
          rows: 3,
        },
      ],
    },
    {
      id: "vendor-rfq",
      title: t("task_market.task_vendor_rfq_title"),
      price: 3.99,
      category: t("task_market.cat_operations"),
      agentId: "operation",
      shortDesc: t("task_market.task_vendor_rfq_short"),
      description: t("task_market.task_vendor_rfq_desc"),
      icon: Package,
      color: "text-teal-600",
      bg: "bg-teal-50",
      fields: [
        {
          id: "productCategories",
          label: t("task_market.field_product_categories"),
          type: "select",
          options: [
            { label: t("task_market.opt_meat_poultry"), value: "meat and poultry" },
            { label: t("task_market.opt_produce"), value: "produce and fresh vegetables" },
            { label: t("task_market.opt_seafood"), value: "seafood and fish" },
            { label: t("task_market.opt_dry_goods"), value: "dry goods and pantry staples" },
            { label: t("task_market.opt_beverages"), value: "beverages and alcohol" },
            { label: t("task_market.opt_multiple_categories"), value: "meat, produce, dry goods, and beverages" },
          ],
        },
        { id: "monthlyVolume", label: t("task_market.field_monthly_volume"), type: "text", placeholder: t("task_market.ph_monthly_volume") },
      ],
    },
    {
      id: "recipe-scaler",
      title: t("task_market.task_recipe_scaler_title"),
      price: 1.99,
      category: t("task_market.cat_chef"),
      agentId: "chef",
      shortDesc: t("task_market.task_recipe_scaler_short"),
      description: t("task_market.task_recipe_scaler_desc"),
      icon: FlaskConical,
      color: "text-orange-600",
      bg: "bg-orange-50",
      fields: [
        {
          id: "originalRecipe",
          label: t("task_market.field_original_recipe"),
          type: "textarea",
          placeholder: t("task_market.ph_original_recipe"),
          rows: 8,
          description: t("task_market.desc_original_recipe"),
        },
        { id: "targetPortions", label: t("task_market.field_target_portions"), type: "number", placeholder: t("task_market.ph_target_portions") },
      ],
    },
    {
      id: "seasonal-menu",
      title: t("task_market.task_seasonal_menu_title"),
      price: 9.99,
      category: t("task_market.cat_chef"),
      agentId: "chef",
      shortDesc: t("task_market.task_seasonal_menu_short"),
      description: t("task_market.task_seasonal_menu_desc"),
      icon: Leaf,
      color: "text-orange-600",
      bg: "bg-orange-50",
      fields: [
        { id: "cuisineType", label: t("task_market.field_cuisine_type"), type: "text", placeholder: t("task_market.ph_cuisine_type") },
        {
          id: "season",
          label: t("task_market.field_season"),
          type: "select",
          options: [
            { label: t("task_market.opt_spring"), value: "spring" },
            { label: t("task_market.opt_summer"), value: "summer" },
            { label: t("task_market.opt_fall"), value: "fall / autumn" },
            { label: t("task_market.opt_winter"), value: "winter" },
          ],
        },
        { id: "budgetPerDish", label: t("task_market.field_budget_per_dish"), type: "text", placeholder: t("task_market.ph_budget_per_dish") },
      ],
    },
    {
      id: "allergen-audit",
      title: t("task_market.task_allergen_audit_title"),
      price: 4.99,
      category: t("task_market.cat_chef"),
      agentId: "chef",
      shortDesc: t("task_market.task_allergen_audit_short"),
      description: t("task_market.task_allergen_audit_desc"),
      icon: ShieldAlert,
      color: "text-orange-600",
      bg: "bg-orange-50",
      fields: [
        {
          id: "menuText",
          label: t("task_market.field_menu_with_ingredients"),
          type: "textarea",
          placeholder: t("task_market.ph_menu_with_ingredients"),
          rows: 10,
          description: t("task_market.desc_menu_with_ingredients"),
        },
      ],
    },
    {
      id: "staff-meal",
      title: t("task_market.task_staff_meal_title"),
      price: 2.99,
      category: t("task_market.cat_chef"),
      agentId: "chef",
      shortDesc: t("task_market.task_staff_meal_short"),
      description: t("task_market.task_staff_meal_desc"),
      icon: UtensilsCrossed,
      color: "text-orange-600",
      bg: "bg-orange-50",
      fields: [
        { id: "teamSize", label: t("task_market.field_staff_to_feed"), type: "number", placeholder: t("task_market.ph_staff_to_feed") },
        {
          id: "availableIngredients",
          label: t("task_market.field_available_ingredients"),
          type: "textarea",
          placeholder: t("task_market.ph_available_ingredients"),
          rows: 4,
        },
        { id: "dailyBudget", label: t("task_market.field_daily_budget"), type: "text", placeholder: t("task_market.ph_daily_budget") },
      ],
    },
    {
      id: "menu-description",
      title: t("task_market.task_menu_description_title"),
      price: 4.99,
      category: t("task_market.cat_chef"),
      agentId: "chef",
      shortDesc: t("task_market.task_menu_description_short"),
      description: t("task_market.task_menu_description_desc"),
      icon: Sparkles,
      color: "text-orange-600",
      bg: "bg-orange-50",
      fields: [
        {
          id: "dishList",
          label: t("task_market.field_dish_list"),
          type: "textarea",
          placeholder: t("task_market.ph_dish_list"),
          rows: 8,
          description: t("task_market.desc_dish_list"),
        },
        {
          id: "style",
          label: t("task_market.field_writing_style"),
          type: "select",
          options: [
            { label: t("task_market.opt_warm_approachable"), value: "warm and approachable, like a friendly neighborhood bistro" },
            { label: t("task_market.opt_upscale_evocative"), value: "upscale and evocative, fine dining tone" },
            { label: t("task_market.opt_fun_casual"), value: "fun and casual, like a lively bar or fast-casual spot" },
          ],
        },
      ],
    },

    // ── New tasks from the expansion set ──────────────────────────────────────

    {
      id: "lease-negotiation",
      title: t("task_market.task_lease_negotiation_title"),
      price: 24.99,
      category: t("task_market.cat_legal_hr"),
      agentId: "legal",
      shortDesc: t("task_market.task_lease_negotiation_short"),
      description: t("task_market.task_lease_negotiation_desc"),
      icon: Building2,
      color: "text-violet-600",
      bg: "bg-violet-50",
      fields: [
        { id: "currentRent", label: t("task_market.field_current_rent"), type: "number", placeholder: t("task_market.ph_current_rent") },
        { id: "leaseEndDate", label: t("task_market.field_lease_end_date"), type: "text", placeholder: t("task_market.ph_lease_end_date") },
        { id: "squareFootage", label: t("task_market.field_square_footage"), type: "number", placeholder: t("task_market.ph_square_footage") },
        { id: "propertyCity", label: t("task_market.field_property_city"), type: "text", placeholder: t("task_market.ph_property_city") },
        { id: "comparableRents", label: t("task_market.field_comparable_rents"), type: "text", placeholder: t("task_market.ph_comparable_rents") },
        {
          id: "negotiationGoal",
          label: t("task_market.field_negotiation_goal"),
          type: "select",
          options: [
            { label: t("task_market.opt_reduce_rent"), value: "reduce monthly rent by 10–20%" },
            { label: t("task_market.opt_extend_lease"), value: "extend the lease with a rent freeze or modest increase" },
            { label: t("task_market.opt_rent_free"), value: "secure a 2–3 month rent-free period or TI allowance" },
            { label: t("task_market.opt_exit_sublease"), value: "negotiate an early exit or sublease option" },
          ],
        },
      ],
    },

    {
      id: "pricing-formula",
      title: t("task_market.task_pricing_formula_title"),
      price: 9.99,
      category: t("task_market.cat_finance"),
      agentId: "finance",
      shortDesc: t("task_market.task_pricing_formula_short"),
      description: t("task_market.task_pricing_formula_desc"),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      fields: [
        { id: "currentAvgCheck", label: t("task_market.field_current_avg_check"), type: "number", placeholder: t("task_market.ph_current_avg_check") },
        { id: "foodCostPct", label: t("task_market.field_food_cost_pct_current"), type: "number", placeholder: t("task_market.ph_food_cost_pct") },
        { id: "monthlyRevenue", label: t("task_market.field_current_monthly_revenue"), type: "text", placeholder: t("task_market.ph_current_monthly_revenue") },
        { id: "seatingCapacity", label: t("task_market.field_seating_capacity"), type: "number", placeholder: t("task_market.ph_seating_capacity") },
        { id: "weeklyCovers", label: t("task_market.field_weekly_covers"), type: "number", placeholder: t("task_market.ph_weekly_covers") },
      ],
    },

    {
      id: "pos-vendor-comparison",
      title: t("task_market.task_pos_vendor_title"),
      price: 12.99,
      category: t("task_market.cat_operations"),
      agentId: "operation",
      shortDesc: t("task_market.task_pos_vendor_short"),
      description: t("task_market.task_pos_vendor_desc"),
      icon: Monitor,
      color: "text-teal-600",
      bg: "bg-teal-50",
      fields: [
        { id: "currentPOS", label: t("task_market.field_current_pos"), type: "text", placeholder: t("task_market.ph_current_pos") },
        { id: "monthlyCost", label: t("task_market.field_monthly_pos_cost"), type: "number", placeholder: t("task_market.ph_monthly_pos_cost") },
        {
          id: "restaurantType",
          label: t("task_market.field_restaurant_type"),
          type: "select",
          options: [
            { label: t("task_market.opt_full_service_casual"), value: "full-service casual dining" },
            { label: t("task_market.opt_fast_casual"), value: "fast casual or counter service" },
            { label: t("task_market.opt_fine_dining"), value: "fine dining" },
            { label: t("task_market.opt_bar_nightclub"), value: "bar or nightclub" },
            { label: t("task_market.opt_food_truck_popup"), value: "food truck or pop-up" },
          ],
        },
        { id: "transactionVolume", label: t("task_market.field_transaction_volume"), type: "text", placeholder: t("task_market.ph_transaction_volume") },
        {
          id: "painPoints",
          label: t("task_market.field_pain_points"),
          type: "textarea",
          placeholder: t("task_market.ph_pain_points"),
          rows: 3,
        },
      ],
    },

    {
      id: "labor-utilization",
      title: t("task_market.task_labor_utilization_title"),
      price: 11.99,
      category: t("task_market.cat_operations"),
      agentId: "operation",
      shortDesc: t("task_market.task_labor_utilization_short"),
      description: t("task_market.task_labor_utilization_desc"),
      icon: BarChart2,
      color: "text-teal-600",
      bg: "bg-teal-50",
      fields: [
        {
          id: "teamInfo",
          label: t("task_market.field_team_composition"),
          type: "textarea",
          placeholder: t("task_market.ph_team_composition"),
          rows: 3,
        },
        { id: "operatingHours", label: t("task_market.field_operating_hours"), type: "text", placeholder: t("task_market.ph_operating_hours") },
        { id: "peakHours", label: t("task_market.field_peak_hours"), type: "text", placeholder: t("task_market.ph_peak_hours") },
        { id: "currentLaborPct", label: t("task_market.field_current_labor_pct"), type: "number", placeholder: t("task_market.ph_current_labor_pct") },
      ],
    },

    {
      id: "supplier-comparison",
      title: t("task_market.task_supplier_comparison_title"),
      price: 14.99,
      category: t("task_market.cat_operations"),
      agentId: "operation",
      shortDesc: t("task_market.task_supplier_comparison_short"),
      description: t("task_market.task_supplier_comparison_desc"),
      icon: Truck,
      color: "text-teal-600",
      bg: "bg-teal-50",
      fields: [
        { id: "productCategory", label: t("task_market.field_product_category"), type: "text", placeholder: t("task_market.ph_product_category") },
        {
          id: "currentSupplierInfo",
          label: t("task_market.field_current_supplier_info"),
          type: "textarea",
          placeholder: t("task_market.ph_current_supplier_info"),
          rows: 6,
          description: t("task_market.desc_current_supplier_info"),
        },
        { id: "monthlyVolume", label: t("task_market.field_monthly_volume"), type: "text", placeholder: t("task_market.ph_monthly_volume_supplier") },
        { id: "targetBudget", label: t("task_market.field_target_budget"), type: "text", placeholder: t("task_market.ph_target_budget") },
      ],
    },

    {
      id: "local-acquisition",
      title: t("task_market.task_local_acquisition_title"),
      price: 14.99,
      category: t("task_market.cat_marketing"),
      agentId: "social",
      shortDesc: t("task_market.task_local_acquisition_short"),
      description: t("task_market.task_local_acquisition_desc"),
      icon: Users,
      color: "text-pink-600",
      bg: "bg-pink-50",
      fields: [
        { id: "restaurantAddress", label: t("task_market.field_restaurant_address"), type: "text", placeholder: t("task_market.ph_restaurant_address") },
        { id: "cuisineType", label: t("task_market.field_cuisine_type"), type: "text", placeholder: t("task_market.ph_cuisine_type_specific") },
        {
          id: "priceRange",
          label: t("task_market.field_price_range"),
          type: "select",
          options: [
            { label: t("task_market.opt_under_15"), value: "under $15 — fast casual / value dining" },
            { label: t("task_market.opt_15_30"), value: "$15–$30 — casual dining" },
            { label: t("task_market.opt_30_60"), value: "$30–$60 — upscale casual" },
            { label: t("task_market.opt_60_plus"), value: "over $60 — fine dining" },
          ],
        },
        { id: "currentCustomerProfile", label: t("task_market.field_current_customer_profile"), type: "text", placeholder: t("task_market.ph_current_customer_profile") },
        {
          id: "growthGoal",
          label: t("task_market.field_growth_goal"),
          type: "select",
          options: [
            { label: t("task_market.opt_grow_lunch"), value: "grow weekday lunch covers by 30% in 90 days" },
            { label: t("task_market.opt_attract_dinner"), value: "attract new dinner customers from underserved segments" },
            { label: t("task_market.opt_increase_delivery"), value: "grow delivery orders through local digital acquisition" },
            { label: t("task_market.opt_build_events"), value: "build a local private events and catering client pipeline" },
          ],
        },
      ],
    },

    {
      id: "channel-expansion",
      title: t("task_market.task_channel_expansion_title"),
      price: 19.99,
      category: t("task_market.cat_operations"),
      agentId: "operation",
      shortDesc: t("task_market.task_channel_expansion_short"),
      description: t("task_market.task_channel_expansion_desc"),
      icon: ShoppingBag,
      color: "text-teal-600",
      bg: "bg-teal-50",
      fields: [
        { id: "currentRevenueMix", label: t("task_market.field_current_revenue_mix"), type: "text", placeholder: t("task_market.ph_current_revenue_mix") },
        { id: "seatingCapacity", label: t("task_market.field_total_seating"), type: "number", placeholder: t("task_market.ph_total_seating") },
        {
          id: "kitchenCapacity",
          label: t("task_market.field_kitchen_capacity"),
          type: "textarea",
          placeholder: t("task_market.ph_kitchen_capacity"),
          rows: 3,
        },
        {
          id: "targetChannel",
          label: t("task_market.field_target_channel"),
          type: "select",
          options: [
            { label: t("task_market.opt_takeout_delivery"), value: "takeout and third-party delivery platforms" },
            { label: t("task_market.opt_private_dining"), value: "private dining, banquets, and events" },
            { label: t("task_market.opt_offsite_catering"), value: "off-site corporate and event catering" },
            { label: t("task_market.opt_both_channels"), value: "both takeout/delivery and private dining" },
          ],
        },
        { id: "targetRevenueIncrease", label: t("task_market.field_target_revenue_increase"), type: "text", placeholder: t("task_market.ph_target_revenue_increase") },
      ],
    },
  ];
}

const TASK_PALETTE: Record<string, { accent: string; iconBg: string; glow: string }> = {
  "text-teal-600":    { accent: "#0d9488", iconBg: "rgba(13,148,136,0.13)",  glow: "rgba(13,148,136,0.15)"  },
  "text-pink-600":    { accent: "#db2777", iconBg: "rgba(219,39,119,0.13)",  glow: "rgba(219,39,119,0.15)"  },
  "text-blue-600":    { accent: "#2563eb", iconBg: "rgba(37,99,235,0.13)",   glow: "rgba(37,99,235,0.15)"   },
  "text-emerald-600": { accent: "#059669", iconBg: "rgba(5,150,105,0.13)",   glow: "rgba(5,150,105,0.15)"   },
  "text-orange-600":  { accent: "#ea580c", iconBg: "rgba(234,88,12,0.13)",   glow: "rgba(234,88,12,0.15)"   },
  "text-violet-600":  { accent: "#7c3aed", iconBg: "rgba(124,58,237,0.13)",  glow: "rgba(124,58,237,0.15)"  },
  "text-amber-600":   { accent: "#d97706", iconBg: "rgba(217,119,6,0.13)",   glow: "rgba(217,119,6,0.15)"   },
  "text-purple-600":  { accent: "#9333ea", iconBg: "rgba(147,51,234,0.13)",  glow: "rgba(147,51,234,0.15)"  },
};

// ─── Payment Modal ─────────────────────────────────────────────────────────────

function PaymentModal({ task, onClose, onSuccess }: {
  task: Task;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", name: "" });

  const formatCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const handlePay = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setPaid(true); }, 1200);
    setTimeout(() => onSuccess(), 2800);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!paid ? onClose : undefined} />

      {/* Modal */}
      <div className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {!paid ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("task_market.one_time_task")}</p>
                <p className="text-base font-bold text-foreground leading-snug">{task.title}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-2xl font-bold text-primary">${task.price.toFixed(2)}</p>
              </div>
            </div>

            {/* Card form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">{t("task_market.card_number")}</Label>
                <div className="relative">
                  <Input
                    data-testid="input-card-number"
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    onChange={e => setCard(c => ({ ...c, number: formatCard(e.target.value) }))}
                    className="pr-10 font-mono text-sm"
                    maxLength={19}
                  />
                  <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">{t("task_market.card_expiry")}</Label>
                  <Input
                    data-testid="input-card-expiry"
                    placeholder="MM/YY"
                    value={card.expiry}
                    onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                    className="font-mono text-sm"
                    maxLength={5}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">{t("task_market.card_cvc")}</Label>
                  <Input
                    data-testid="input-card-cvc"
                    placeholder="123"
                    value={card.cvc}
                    onChange={e => setCard(c => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                    className="font-mono text-sm"
                    maxLength={3}
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">{t("task_market.card_name")}</Label>
                <Input
                  data-testid="input-card-name"
                  placeholder="Jane Smith"
                  value={card.name}
                  onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 space-y-3">
              <button
                data-testid="button-pay"
                onClick={handlePay}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-3 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {loading ? t("task_market.processing") : t("task_market.pay_btn", { amount: task.price.toFixed(2) })}
              </button>
              <p className="text-center text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> {t("task_market.secured_encryption")}
              </p>
            </div>
          </>
        ) : (
          /* Success state */
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">{t("task_market.payment_successful")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("task_market.launching_agent")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BrowseView({ tasks, onSelect, hiredAgentIds }: {
  tasks: Task[];
  onSelect: (task: Task) => void;
  hiredAgentIds: Set<string>;
}) {
  const { t } = useTranslation();
  const categories = Array.from(new Set(tasks.map((task) => task.category)));

  return (
    <div className="px-6 py-6 space-y-9 overflow-y-auto h-full">
      {categories.map((category) => {
        const categoryTasks = tasks.filter((task) => task.category === category);
        const catPal = TASK_PALETTE[categoryTasks[0]?.color] ?? { accent: "#888", iconBg: "#f0f0f0", glow: "#f0f0f0" };
        return (
          <section key={category}>
            {/* Section header with rule */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.12em] flex-shrink-0"
                style={{ color: catPal.accent }}>
                {category}
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {categoryTasks.map((task) => {
                const Icon = task.icon;
                const taskHired = !!(task.agentId && hiredAgentIds.has(task.agentId));
                const pal = TASK_PALETTE[task.color] ?? catPal;
                const isHot = !taskHired && !!task.agentId;

                return (
                  <button
                    key={task.id}
                    data-testid={`card-task-${task.id}`}
                    onClick={() => onSelect(task)}
                    className="group text-left bg-white rounded-2xl p-4 flex flex-col gap-3 relative transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px ${pal.accent}33`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)";
                    }}
                  >
                    {/* Top: icon + price */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: taskHired ? "rgba(22,163,74,0.13)" : pal.iconBg }}>
                        <Icon size={18} className={task.color} />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {taskHired ? (
                          <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 leading-none">
                            {t("task_market.free")}
                          </span>
                        ) : (
                          <span
                            className="text-sm font-bold tabular-nums leading-none"
                            style={{ color: pal.accent }}>
                            ${task.price.toFixed(2)}
                          </span>
                        )}
                        {isHot && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-rose-400 bg-rose-50 border border-rose-200 rounded-full px-1.5 py-px leading-none">
                            {t("task_market.hot")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{task.title}</p>

                    {/* Desc */}
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 flex-1">{task.shortDesc}</p>

                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DetailView({ task, onBack }: { task: Task; onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const Icon = task.icon;

  const set = (id: string, val: string) => setValues((v) => ({ ...v, [id]: val }));

  const handleRun = async () => {
    const missing = task.fields.filter((f) => !values[f.id]?.trim());
    if (missing.length) {
      toast({
        title: t("task_market.missing_fields"),
        description: `${t("task_market.please_fill_in")} ${missing.map((f) => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    setRunning(true);
    setResult("");
    try {
      const res = await apiRequest("POST", "/api/task-market/run", { taskId: task.id, inputs: values });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("task_market.something_went_wrong"));
      setResult(data.text);
    } catch (err: any) {
      toast({ title: t("task_market.error"), description: err.message || t("task_market.failed_to_run"), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/30 flex-shrink-0">
        <button
          onClick={onBack}
          data-testid="button-back-task-market"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("task_market.page_title")}
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium text-foreground">{task.title}</span>
      </div>

      {/* Body: form left, results right */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Form panel */}
        <div className="w-[440px] flex-shrink-0 border-r border-border overflow-y-auto p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", task.bg)}>
              <Icon size={20} className={task.color} />
            </div>
            <div className="flex-1">
              <h2 className="font-serif text-lg font-bold text-foreground leading-tight">{task.title}</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{task.description}</p>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="space-y-4">
            {task.fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={`${task.id}-${field.id}`} className="text-sm font-medium text-foreground">
                  {field.label}
                </Label>
                {field.description && (
                  <p className="text-sm text-muted-foreground">{field.description}</p>
                )}
                {field.type === "textarea" && (
                  <Textarea
                    id={`${task.id}-${field.id}`}
                    data-testid={`input-task-${task.id}-${field.id}`}
                    placeholder={field.placeholder}
                    rows={field.rows ?? 4}
                    value={values[field.id] ?? ""}
                    onChange={(e) => set(field.id, e.target.value)}
                    className="font-mono text-sm resize-none"
                  />
                )}
                {field.type === "select" && (
                  <Select value={values[field.id] ?? ""} onValueChange={(v) => set(field.id, v)}>
                    <SelectTrigger id={`${task.id}-${field.id}`} data-testid={`select-task-${task.id}-${field.id}`}>
                      <SelectValue placeholder={t("task_market.select_option")} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {(field.type === "text" || field.type === "number") && (
                  <Input
                    id={`${task.id}-${field.id}`}
                    data-testid={`input-task-${task.id}-${field.id}`}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={values[field.id] ?? ""}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <Button
            onClick={handleRun}
            disabled={running}
            className="w-full gap-2"
            data-testid={`button-run-${task.id}`}
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t("task_market.generating")}</>
            ) : (
              <><Play className="w-4 h-4" /> {t("task_market.run_btn", { amount: task.price.toFixed(2) })}</>
            )}
          </Button>
        </div>

        {/* Results panel */}
        <div className="flex-1 overflow-y-auto bg-background px-8 py-6">
          {!result && !running ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Play className="w-5 h-5 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium">{t("task_market.results_appear_here")}</p>
              <p className="text-sm mt-1 text-muted-foreground/60">{t("task_market.fill_and_run")}</p>
            </div>
          ) : running ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm font-medium">{t("task_market.generating_report")}</p>
              <p className="text-sm text-muted-foreground/60">{t("task_market.ready_in_30s")}</p>
            </div>
          ) : (
            <div
              data-testid="result-output"
              className="prose prose-sm max-w-2xl
                prose-headings:font-serif prose-headings:text-foreground
                prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-h3:font-semibold
                prose-p:text-foreground/85 prose-p:leading-relaxed
                prose-li:text-foreground/85 prose-ul:space-y-0.5
                prose-strong:text-foreground prose-strong:font-semibold
                prose-table:w-full prose-table:text-sm
                prose-th:bg-muted/60 prose-th:text-foreground prose-th:font-semibold prose-th:text-left prose-th:px-3 prose-th:py-2
                prose-td:px-3 prose-td:py-2 prose-td:text-foreground/80
                prose-code:text-primary prose-code:text-sm
                pb-12
              "
            >
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const HIRED_KEY = "favie_hired_agents";
const getHiredAgents = () =>
  new Set<string>(JSON.parse(localStorage.getItem(HIRED_KEY) || "[]"));

export default function TaskMarket() {
  const { t } = useTranslation();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [paymentTask, setPaymentTask] = useState<Task | null>(null);
  const [hiredAgentIds, setHiredAgentIds] = useState<Set<string>>(getHiredAgents);
  const search = useSearch();
  const [, navigate] = useLocation();
  const tasks = useTasks();

  // Keep hired state in sync across tabs and agent chat pages
  useEffect(() => {
    const handler = () => setHiredAgentIds(getHiredAgents());
    window.addEventListener("hired-agents-changed", handler);
    return () => window.removeEventListener("hired-agents-changed", handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const taskId = params.get("task");
    if (taskId) {
      const found = tasks.find((task) => task.id === taskId);
      if (found) {
        if (found.agentId && !hiredAgentIds.has(found.agentId)) {
          setPaymentTask(found);
        } else {
          navigate(`/admin/agents/${found.agentId}?task=${taskId}`);
        }
      }
    }
  }, [search, tasks]);

  const handleSelect = (task: Task) => {
    if (task.agentId && hiredAgentIds.has(task.agentId)) {
      // Agent is hired → go directly to agent chat with this task
      navigate(`/admin/agents/${task.agentId}?task=${task.id}`);
    } else {
      // Not hired → show payment modal first
      setPaymentTask(task);
    }
  };

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-2.5 flex-shrink-0">
        <ShoppingBag className="w-5 h-5 text-primary" />
        <div>
          <h1 className="font-serif text-xl font-bold text-foreground leading-tight">{t("task_market.page_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("task_market.page_subtitle")}</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative" style={{ height: "calc(100vh - 72px)" }}>
        {/* Payment modal scoped to task market content area */}
        {paymentTask && (
          <PaymentModal
            task={paymentTask}
            onClose={() => setPaymentTask(null)}
            onSuccess={() => {
              const { id, agentId } = paymentTask;
              setPaymentTask(null);
              navigate(`/admin/agents/${agentId ?? "legal"}?task=${id}`);
            }}
          />
        )}
        {activeTask ? (
          <DetailView task={activeTask} onBack={() => setActiveTask(null)} />
        ) : (
          <BrowseView tasks={tasks} onSelect={handleSelect} hiredAgentIds={hiredAgentIds} />
        )}
      </div>
    </AdminLayout>
  );
}
