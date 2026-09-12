# Auth emails

Favie sends its own authentication emails (confirm signup, magic link, password reset, email change,
invite, re-authentication code) instead of Supabase's stock ones.

## How it works

1. Supabase Auth calls our **Send Email hook** `POST /api/auth/send-email` (Standard Webhooks
   signature, secret in `SUPABASE_SEND_EMAIL_HOOK_SECRET`).
2. The route looks up the owner's language (`users.locale`, else sign-up metadata, else English),
   renders `src/lib/email/auth-templates.ts` in that language, builds the link to OUR confirm route
   (`/auth/confirm?token_hash=…&type=…&next=…`) and sends through **Resend** (`RESEND_API_KEY`,
   sender `AUTH_EMAIL_FROM`, default `Favie <hello@favie.us>`; favie.us is a verified Resend domain).
3. Fallback: the same copy, bilingual EN + 简体, is also stored in Supabase as Go templates, and custom
   SMTP (smtp.resend.com) is configured, so if the hook is ever disabled Supabase still sends
   Favie-branded mail from hello@favie.us. Note: on that fallback path Supabase ignores the configured
   subject and uses the template's `<title>` (observed 2026-09-12), which is why the hook is the
   primary path.

## Configuration (Supabase Management API)

`scripts/supabase-auth-config.ts` pushes everything; it needs a personal access token (`sbp_…`):

```bash
env SUPABASE_ACCESS_TOKEN=sbp_… \
    SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend SMTP_PASS=re_… SMTP_SENDER=hello@favie.us \
    SEND_EMAIL_HOOK_URL=https://<app host>/api/auth/send-email SEND_EMAIL_HOOK_SECRET='v1,whsec_…' \
    npx tsx scripts/supabase-auth-config.ts
```

It also sets `site_url` from `NEXT_PUBLIC_APP_URL` and the redirect allow-list. **When production
launches on favie.us, run it again with `NEXT_PUBLIC_APP_URL=https://favie.us` and the hook URL on
favie.us**, and put `RESEND_API_KEY`, `SUPABASE_SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM` in the
production environment. The hook host must be reachable from Supabase (in dev that is the
`favie-local` Cloudflare tunnel → dev.favie.us).

Email rate limit is raised to 100/hour (`rate_limit_email_sent`); the default channel allowed 2/hour.

## Editing copy

Edit `COPY` in `src/lib/email/auth-templates.ts` (5 languages). Preview:
`npx tsx scripts/supabase-auth-config.ts --render` writes the bilingual fallback HTML to
`supabase/email-templates/`. The hook path picks changes up on the next deploy; the fallback templates
need the push script re-run.

## Password reset

`/forgot-password` → `resetPasswordForEmail` → recovery mail → `/auth/confirm?type=recovery` →
`/reset-password` (`updateUser({ password })`).
