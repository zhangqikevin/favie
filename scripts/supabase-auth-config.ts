/**
 * Push Favie's auth email templates (and optionally custom SMTP) to the Supabase project through the
 * Management API. Needs a PERSONAL access token (Dashboard → Account → Access Tokens), not the service key:
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_… npx tsx scripts/supabase-auth-config.ts            # templates + site URL
 *   SUPABASE_ACCESS_TOKEN=sbp_… SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend \
 *     SMTP_PASS=re_… SMTP_SENDER=hello@favie.us npx tsx scripts/supabase-auth-config.ts  # + custom SMTP
 *   npx tsx scripts/supabase-auth-config.ts --render                                 # write HTML previews only
 *   SEND_EMAIL_HOOK_URL=https://dev.favie.us/api/auth/send-email SEND_EMAIL_HOOK_SECRET=v1,whsec_… \
 *     npx tsx scripts/supabase-auth-config.ts                                        # + route all auth mail through our hook
 *
 * Idempotent: it PATCHes the auth config; run it again after editing src/lib/email/auth-templates.ts.
 */
import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import { goTemplates } from '../src/lib/email/auth-templates'
const AUTH_TEMPLATES = goTemplates()

const ref = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')?.[1]
const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://favie.us').replace(/\/$/, '')
const renderOnly = process.argv.includes('--render')

// Previews for review (Go template variables left as-is).
mkdirSync('supabase/email-templates', { recursive: true })
for (const [key, t] of Object.entries(AUTH_TEMPLATES)) writeFileSync(`supabase/email-templates/${key}.html`, t.html)
writeFileSync('supabase/email-templates/subjects.json', JSON.stringify(Object.fromEntries(Object.entries(AUTH_TEMPLATES).map(([k, t]) => [k, t.subject])), null, 2) + '\n')
console.log(`rendered ${Object.keys(AUTH_TEMPLATES).length} templates to supabase/email-templates/`)
if (renderOnly) process.exit(0)

const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a supabase.co URL')
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN (personal access token, sbp_…) is required to push the config')

const body: Record<string, unknown> = {
  site_url: siteUrl,
  uri_allow_list: [`${siteUrl}/**`, 'http://localhost:3100/**', 'https://dev.favie.us/**'].join(','),
  mailer_subjects_confirmation: AUTH_TEMPLATES.confirmation.subject,
  mailer_templates_confirmation_content: AUTH_TEMPLATES.confirmation.html,
  mailer_subjects_magic_link: AUTH_TEMPLATES.magic_link.subject,
  mailer_templates_magic_link_content: AUTH_TEMPLATES.magic_link.html,
  mailer_subjects_recovery: AUTH_TEMPLATES.recovery.subject,
  mailer_templates_recovery_content: AUTH_TEMPLATES.recovery.html,
  mailer_subjects_email_change: AUTH_TEMPLATES.email_change.subject,
  mailer_templates_email_change_content: AUTH_TEMPLATES.email_change.html,
  mailer_subjects_invite: AUTH_TEMPLATES.invite.subject,
  mailer_templates_invite_content: AUTH_TEMPLATES.invite.html,
  mailer_subjects_reauthentication: AUTH_TEMPLATES.reauthentication.subject,
  mailer_templates_reauthentication_content: AUTH_TEMPLATES.reauthentication.html,
}
if (process.env.SMTP_HOST) {
  Object.assign(body, {
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT ?? '465',
    smtp_user: process.env.SMTP_USER ?? '',
    smtp_pass: process.env.SMTP_PASS ?? '',
    smtp_admin_email: process.env.SMTP_SENDER ?? 'hello@favie.us',
    smtp_sender_name: process.env.SMTP_SENDER_NAME ?? 'Favie',
    smtp_max_frequency: 1, // seconds between mails to one address; the default channel forces 60
  })
}

if (process.env.SEND_EMAIL_HOOK_URL) {
  Object.assign(body, { hook_send_email_enabled: true, hook_send_email_uri: process.env.SEND_EMAIL_HOOK_URL, hook_send_email_secrets: process.env.SEND_EMAIL_HOOK_SECRET })
} else if (process.env.SEND_EMAIL_HOOK_URL === '') {
  Object.assign(body, { hook_send_email_enabled: false })
}
if (process.env.EMAIL_RATE_LIMIT_PER_HOUR) body.rate_limit_email_sent = Number(process.env.EMAIL_RATE_LIMIT_PER_HOUR)

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
})
const text = await res.text()
if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 500)}`)
const j = JSON.parse(text) as Record<string, unknown>
console.log('updated auth config:', { site_url: j.site_url, smtp_host: j.smtp_host ?? '(default Supabase channel)', smtp_sender_name: j.smtp_sender_name, hook: j.hook_send_email_enabled ? j.hook_send_email_uri : 'off', rate_limit_email_sent: j.rate_limit_email_sent })
