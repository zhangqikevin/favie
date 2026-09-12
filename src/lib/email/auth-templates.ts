/**
 * Supabase Auth email templates (confirm signup, magic link, password reset, email change, invite,
 * re-authentication), rendered as Go templates for Supabase's mailer. One layout, Favie branding,
 * English first then 中文 — Supabase templates cannot switch language per user, so both are in one mail.
 *
 * Links go to OUR confirm route (`{{ .SiteURL }}/auth/confirm?token_hash=…&type=…&next=…`) so the
 * owner never sees a supabase.co URL. `scripts/supabase-auth-config.ts` pushes these to the project.
 */

export type AuthTemplateKey = 'confirmation' | 'magic_link' | 'recovery' | 'email_change' | 'invite' | 'reauthentication'

const BRAND = { name: 'Favie', blue: '#2f66ff', ink: '#111827', muted: '#6b7280', bg: '#f3f4f6', card: '#ffffff', border: '#e5e7eb' }

function layout(opts: { preheader: string; titleEn: string; titleZh: string; bodyEn: string; bodyZh: string; cta?: { href: string; en: string; zh: string }; code?: string; footEn: string; footZh: string }) {
  const cta = opts.cta ? `
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px auto 8px;">
              <tr><td style="border-radius:999px;background:${BRAND.blue};">
                <a href="${opts.cta.href}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${opts.cta.en} · ${opts.cta.zh}</a>
              </td></tr>
            </table>
            <p style="margin:0 0 4px;font-size:12px;color:${BRAND.muted};text-align:center;">If the button does not work, copy this link into your browser · 按钮无法点击时请复制链接到浏览器：</p>
            <p style="margin:0 0 20px;font-size:12px;color:${BRAND.muted};text-align:center;word-break:break-all;"><a href="${opts.cta.href}" style="color:${BRAND.blue};text-decoration:none;">${opts.cta.href}</a></p>` : ''
  const code = opts.code ? `
            <p style="margin:24px 0 8px;font-size:13px;color:${BRAND.muted};text-align:center;">Your code · 验证码</p>
            <p style="margin:0 0 20px;font-family:SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;letter-spacing:6px;font-weight:700;color:${BRAND.ink};text-align:center;">${opts.code}</p>` : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.titleEn}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${opts.preheader}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
        <tr><td style="padding:0 8px 18px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="vertical-align:middle;"><img src="{{ .SiteURL }}/logo.png" width="36" height="36" alt="${BRAND.name}" style="display:block;border-radius:10px;"></td>
            <td style="vertical-align:middle;padding-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:18px;font-weight:700;color:${BRAND.ink};">${BRAND.name}</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${BRAND.card};border-radius:24px;padding:36px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:${BRAND.ink};">
            <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;font-weight:700;">${opts.titleEn}</h1>
            <p style="margin:0 0 20px;font-size:16px;color:${BRAND.muted};">${opts.titleZh}</p>
            <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">${opts.bodyEn}</p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:${BRAND.muted};">${opts.bodyZh}</p>
            ${cta}${code}
            <hr style="border:0;border-top:1px solid ${BRAND.border};margin:8px 0 16px;">
            <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${BRAND.muted};">${opts.footEn}</p>
            <p style="margin:0;font-size:12px;line-height:1.7;color:${BRAND.muted};">${opts.footZh}</p>
        </td></tr>
        <tr><td style="padding:18px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:${BRAND.muted};text-align:center;">
          ${BRAND.name} · AI that runs your Uber Eats and DoorDash · <a href="{{ .SiteURL }}" style="color:${BRAND.muted};">{{ .SiteURL }}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const confirm = (type: string, next: string) => `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${encodeURIComponent(next)}`

export const AUTH_TEMPLATES: Record<AuthTemplateKey, { subject: string; html: string }> = {
  confirmation: {
    subject: 'Confirm your Favie account · 确认你的 Favie 账户',
    html: layout({
      preheader: 'One click to confirm your email and continue setting up Favie.',
      titleEn: 'Confirm your email', titleZh: '确认你的邮箱',
      bodyEn: 'Thanks for signing up for Favie. Confirm this address to continue to payment and connect your Uber Eats and DoorDash accounts.',
      bodyZh: '感谢注册 Favie。确认邮箱后即可继续完成付款，并连接你的 Uber Eats 和 DoorDash 账户。',
      cta: { href: confirm('signup', '/onboarding'), en: 'Confirm email', zh: '确认邮箱' },
      footEn: 'This link expires in 24 hours. If you did not create a Favie account, you can ignore this email.',
      footZh: '链接 24 小时内有效。如果这不是你本人的操作，请忽略此邮件。',
    }),
  },
  magic_link: {
    subject: 'Your Favie sign-in link · 你的 Favie 登录链接',
    html: layout({
      preheader: 'Sign in to Favie with one click.',
      titleEn: 'Sign in to Favie', titleZh: '登录 Favie',
      bodyEn: 'Click the button below to sign in. No password needed.',
      bodyZh: '点击下方按钮即可登录，无需密码。',
      cta: { href: confirm('magiclink', '/dashboard'), en: 'Sign in', zh: '登录' },
      footEn: 'This link expires in 1 hour and can be used once. If you did not request it, you can ignore this email.',
      footZh: '链接 1 小时内有效，仅可使用一次。如果不是你本人请求的，请忽略此邮件。',
    }),
  },
  recovery: {
    subject: 'Reset your Favie password · 重置你的 Favie 密码',
    html: layout({
      preheader: 'Choose a new password for your Favie account.',
      titleEn: 'Reset your password', titleZh: '重置密码',
      bodyEn: 'Someone asked to reset the password for {{ .Email }}. Click below to choose a new one.',
      bodyZh: '有人为 {{ .Email }} 申请了密码重置。点击下方按钮设置新密码。',
      cta: { href: confirm('recovery', '/reset-password'), en: 'Choose a new password', zh: '设置新密码' },
      footEn: 'This link expires in 1 hour. If you did not ask for a reset, your password is unchanged and you can ignore this email.',
      footZh: '链接 1 小时内有效。如果不是你本人申请的，密码不会改变，请忽略此邮件。',
    }),
  },
  email_change: {
    subject: 'Confirm your new email for Favie · 确认你的 Favie 新邮箱',
    html: layout({
      preheader: 'Confirm the change of your Favie sign-in email.',
      titleEn: 'Confirm your new email', titleZh: '确认新邮箱',
      bodyEn: 'You asked to change your Favie sign-in email from {{ .Email }} to {{ .NewEmail }}. Confirm to finish the change.',
      bodyZh: '你申请将 Favie 登录邮箱从 {{ .Email }} 更改为 {{ .NewEmail }}。点击确认以完成更改。',
      cta: { href: confirm('email_change', '/dashboard'), en: 'Confirm new email', zh: '确认新邮箱' },
      footEn: 'If you did not request this change, contact us right away by replying to this email.',
      footZh: '如果这不是你的操作，请直接回复此邮件联系我们。',
    }),
  },
  invite: {
    subject: 'You have been invited to Favie · 邀请你加入 Favie',
    html: layout({
      preheader: 'Accept your invitation to Favie.',
      titleEn: 'You are invited to Favie', titleZh: '邀请你加入 Favie',
      bodyEn: 'You have been invited to manage a restaurant on Favie, the AI that runs Uber Eats and DoorDash every day. Accept the invitation to set your password and get started.',
      bodyZh: '你被邀请在 Favie 上管理一家餐厅。Favie 每天替你打理 Uber Eats 和 DoorDash。点击接受邀请并设置密码。',
      cta: { href: confirm('invite', '/reset-password'), en: 'Accept invitation', zh: '接受邀请' },
      footEn: 'This invitation expires in 24 hours.',
      footZh: '邀请 24 小时内有效。',
    }),
  },
  reauthentication: {
    subject: 'Your Favie verification code · 你的 Favie 验证码',
    html: layout({
      preheader: 'Use this code to confirm a sensitive change.',
      titleEn: 'Confirm it is you', titleZh: '确认是你本人',
      bodyEn: 'Enter this code in Favie to confirm the change you are making.',
      bodyZh: '请在 Favie 中输入此验证码，以确认你正在进行的更改。',
      code: '{{ .Token }}',
      footEn: 'The code expires in 5 minutes. If you did not request it, you can ignore this email.',
      footZh: '验证码 5 分钟内有效。如果不是你本人请求的，请忽略此邮件。',
    }),
  },
}
