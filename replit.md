# Restaurant Growth AI - Marketing Website

## Overview
Multi-page B2B marketing website for an AI-powered restaurant growth service. Covers delivery marketplace optimization (DoorDash/Uber Eats), social media management, short-form video, KOL/KOC collaborations, reputation management, and guest retention. Targets restaurant operators and brands — outcomes-first messaging, professional B2B positioning.

## Architecture
- **Frontend**: React + Wouter (routing) + Tailwind CSS + Framer Motion (animations)
- **Backend**: Express (minimal — serves static frontend only, no API routes needed)
- **No database**: Marketing site with client-side-only forms

## Site Structure (12 pages)
- `/` — Home (hero, services grid, outcomes, process, who we serve, CTA)
- `/services` — Services overview (all 7 service lines in a list)
- `/services/:slug` — Individual service detail (dynamic, 7 routes)
- `/industries` — Who we serve (6 restaurant segment profiles)
- `/about` — About (philosophy, values, differentiators)
- `/results` — How we measure results (6 metric categories, methodology)
- `/faq` — FAQ (4 categories: Working With Us, Services, Performance, Pricing)
- `/contact` — Contact form (full B2B form with success state)

## Key Files
- `client/src/data/services.ts` — All 7 service definitions (slug, title, tagline, problem, whatWeDo[], impact[], ctaText, icon, color)
- `client/src/lib/book-call-context.tsx` — BookCallContext (global modal state, useBookCall() hook)
- `client/src/pages/home.tsx` — Revamped home with B2B outcomes-first messaging
- `client/src/pages/service-detail.tsx` — Dynamic service page template (uses useParams slug)
- `client/src/pages/services-overview.tsx` — /services listing page
- `client/src/pages/industries.tsx` — /industries: 6 segment profiles
- `client/src/pages/about.tsx` — /about company page
- `client/src/pages/results.tsx` — /results measurement framework
- `client/src/pages/faq-page.tsx` — /faq accordion with 4 categories
- `client/src/pages/contact.tsx` — /contact full B2B contact form
- `client/src/components/header.tsx` — Sticky header, transparent on home hero, hover dropdown for Solutions nav
- `client/src/components/footer.tsx` — Full site footer with service and company links
- `client/src/components/book-call-modal.tsx` — Consultation booking modal (global via context)
- `client/src/components/reveal-on-scroll.tsx` — Shared Framer Motion scroll animation wrapper
- `shared/schema.ts` — bookCallSchema + contactFormSchema (Zod)
- `client/src/App.tsx` — All routes registered here

## 7 Service Lines
1. **delivery-advertising** — Delivery Advertising & Storefront Optimization
2. **menu-optimization** — Menu, Bundle & Upsell Optimization
3. **social-media** — Social Media Management
4. **short-form-video** — Short-Form Video Scripts & Content Generation
5. **kol-collaboration** — KOL/KOC Collaboration
6. **reputation-management** — Reviews, Engagement & Reputation Management
7. **member-reactivation** — Member Reactivation & Repeat Purchase

## Design System
- **Colors**: Terracotta primary (HSL 21 55% 50%), Sage secondary (HSL 128 15% 59%), Cream background (HSL 33 38% 95%), Charcoal dark sections (#2A2A2A)
- **Typography**: Inter (body/UI) + Playfair Display (headlines) via Google Fonts
- **Icons**: Lucide React + react-icons/si for social platform logos
- **Animations**: Framer Motion (scroll-reveal via RevealOnScroll, hero parallax)
- **Hover states**: Use `hover-elevate` / `active-elevate-2` utility classes — never `hover:bg-*` or `hover:text-*` on interactive elements

## Forms
- **Book a Consultation modal**: Name, Email, Restaurant Name, City, Primary Challenge (select) — client-side only, success state on submit
- **Contact form**: Name, Email, Restaurant Name, Phone (optional), Primary Challenge, Message — client-side only, success state on submit

## State Management
- `BookCallProvider` wraps the app in `App.tsx`, renders `BookCallModal` at provider level
- Any component calls `const onBookCall = useBookCall()` to open the modal
- No server state management needed (no data fetching)

## Analytics
- Placeholder `window.analytics.track()` stub for future wiring (called on form submits)
