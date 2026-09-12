/**
 * Favie's authentication emails (confirm signup, magic link, password reset, email change, invite,
 * re-authentication code) in the owner's language.
 *
 * Two consumers:
 *  - the Supabase Send Email Hook (`/api/auth/send-email`) renders ONE language per user with
 *    `renderAuthEmail()` and sends through Resend — the normal path;
 *  - `scripts/supabase-auth-config.ts` still pushes bilingual (EN + 中文) Go templates into Supabase as a
 *    fallback for when the hook is disabled; those use `{{ .TokenHash }}` etc. and are built by
 *    `goTemplates()` from the same copy.
 *
 * Links go to OUR confirm route (`/auth/confirm?token_hash=…&type=…&next=…`) so nobody sees supabase.co.
 */

export type AuthEmailType = 'signup' | 'magiclink' | 'recovery' | 'email_change' | 'invite' | 'reauthentication'
export type AuthLocale = 'en' | 'zh-CN' | 'zh-TW' | 'es' | 'ja'

const BRAND = { name: 'Favie', blue: '#2f66ff', ink: '#111827', muted: '#6b7280', bg: '#f3f4f6', card: '#ffffff', border: '#e5e7eb' }
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Hiragino Kaku Gothic ProN',sans-serif"

type Copy = {
  subject: string; preheader: string; title: string; body: string; cta?: string; foot: string; linkHint?: string; codeLabel?: string; tagline: string
}

/** Vars for one email: `{email}`, `{newEmail}` are substituted in copy; `link`/`code` are rendered as button/code. */
type Vars = { siteUrl: string; email: string; newEmail?: string; link?: string; code?: string }

const COMMON: Record<AuthLocale, { linkHint: string; tagline: string; codeLabel: string }> = {
  en: { linkHint: 'If the button does not work, copy this link into your browser:', tagline: 'AI that runs your Uber Eats and DoorDash', codeLabel: 'Your code' },
  'zh-CN': { linkHint: '按钮无法点击时，请把这个链接复制到浏览器打开：', tagline: '每天替你打理 Uber Eats 和 DoorDash 的 AI', codeLabel: '验证码' },
  'zh-TW': { linkHint: '按鈕無法點擊時，請把這個連結複製到瀏覽器開啟：', tagline: '每天替你打理 Uber Eats 和 DoorDash 的 AI', codeLabel: '驗證碼' },
  es: { linkHint: 'Si el botón no funciona, copia este enlace en tu navegador:', tagline: 'La IA que gestiona tu Uber Eats y DoorDash', codeLabel: 'Tu código' },
  ja: { linkHint: 'ボタンが押せない場合は、このリンクをブラウザに貼り付けてください：', tagline: 'Uber Eats と DoorDash を毎日運用する AI', codeLabel: '認証コード' },
}

const COPY: Record<AuthEmailType, Record<AuthLocale, Omit<Copy, 'linkHint' | 'tagline' | 'codeLabel'>>> = {
  signup: {
    en: { subject: 'Confirm your Favie account', preheader: 'One click to confirm your email and continue setting up Favie.', title: 'Confirm your email', body: 'Thanks for signing up for Favie. Confirm this address to continue to payment and connect your Uber Eats and DoorDash accounts.', cta: 'Confirm email', foot: 'This link expires in 24 hours. If you did not create a Favie account, you can ignore this email.' },
    'zh-CN': { subject: '确认你的 Favie 账户', preheader: '点一下确认邮箱，继续完成 Favie 的设置。', title: '确认你的邮箱', body: '感谢注册 Favie。确认邮箱后即可继续完成付款，并连接你的 Uber Eats 和 DoorDash 账户。', cta: '确认邮箱', foot: '链接 24 小时内有效。如果这不是你本人的操作，请忽略此邮件。' },
    'zh-TW': { subject: '確認你的 Favie 帳戶', preheader: '點一下確認電子郵件，繼續完成 Favie 的設定。', title: '確認你的電子郵件', body: '感謝註冊 Favie。確認後即可繼續完成付款，並連接你的 Uber Eats 和 DoorDash 帳戶。', cta: '確認電子郵件', foot: '連結 24 小時內有效。如果這不是你本人的操作，請忽略此郵件。' },
    es: { subject: 'Confirma tu cuenta de Favie', preheader: 'Un clic para confirmar tu correo y seguir configurando Favie.', title: 'Confirma tu correo', body: 'Gracias por registrarte en Favie. Confirma esta dirección para continuar al pago y conectar tus cuentas de Uber Eats y DoorDash.', cta: 'Confirmar correo', foot: 'Este enlace caduca en 24 horas. Si no creaste una cuenta de Favie, ignora este correo.' },
    ja: { subject: 'Favie アカウントの確認', preheader: 'ワンクリックでメールを確認し、Favie の設定を続けましょう。', title: 'メールアドレスを確認', body: 'Favie にご登録いただきありがとうございます。このアドレスを確認すると、お支払いに進み、Uber Eats と DoorDash のアカウントを連携できます。', cta: 'メールを確認', foot: 'このリンクは24時間有効です。Favie に登録していない場合は、このメールを無視してください。' },
  },
  magiclink: {
    en: { subject: 'Your Favie sign-in link', preheader: 'Sign in to Favie with one click.', title: 'Sign in to Favie', body: 'Click the button below to sign in. No password needed.', cta: 'Sign in', foot: 'This link expires in 1 hour and can be used once. If you did not request it, you can ignore this email.' },
    'zh-CN': { subject: '你的 Favie 登录链接', preheader: '点一下即可登录 Favie。', title: '登录 Favie', body: '点击下方按钮即可登录，无需密码。', cta: '登录', foot: '链接 1 小时内有效，仅可使用一次。如果不是你本人请求的，请忽略此邮件。' },
    'zh-TW': { subject: '你的 Favie 登入連結', preheader: '點一下即可登入 Favie。', title: '登入 Favie', body: '點擊下方按鈕即可登入，無需密碼。', cta: '登入', foot: '連結 1 小時內有效，僅可使用一次。如果不是你本人請求的，請忽略此郵件。' },
    es: { subject: 'Tu enlace para entrar en Favie', preheader: 'Entra en Favie con un clic.', title: 'Entrar en Favie', body: 'Haz clic en el botón para iniciar sesión. Sin contraseña.', cta: 'Entrar', foot: 'Este enlace caduca en 1 hora y solo puede usarse una vez. Si no lo solicitaste, ignora este correo.' },
    ja: { subject: 'Favie ログインリンク', preheader: 'ワンクリックで Favie にログイン。', title: 'Favie にログイン', body: '下のボタンを押すとログインできます。パスワードは不要です。', cta: 'ログイン', foot: 'このリンクは1時間有効で、1回だけ使えます。リクエストしていない場合は無視してください。' },
  },
  recovery: {
    en: { subject: 'Reset your Favie password', preheader: 'Choose a new password for your Favie account.', title: 'Reset your password', body: 'Someone asked to reset the password for {email}. Click below to choose a new one.', cta: 'Choose a new password', foot: 'This link expires in 1 hour. If you did not ask for a reset, your password is unchanged and you can ignore this email.' },
    'zh-CN': { subject: '重置你的 Favie 密码', preheader: '为你的 Favie 账户设置新密码。', title: '重置密码', body: '有人为 {email} 申请了密码重置。点击下方按钮设置新密码。', cta: '设置新密码', foot: '链接 1 小时内有效。如果不是你本人申请的，密码不会改变，请忽略此邮件。' },
    'zh-TW': { subject: '重設你的 Favie 密碼', preheader: '為你的 Favie 帳戶設定新密碼。', title: '重設密碼', body: '有人為 {email} 申請了密碼重設。點擊下方按鈕設定新密碼。', cta: '設定新密碼', foot: '連結 1 小時內有效。如果不是你本人申請的，密碼不會改變，請忽略此郵件。' },
    es: { subject: 'Restablece tu contraseña de Favie', preheader: 'Elige una nueva contraseña para tu cuenta de Favie.', title: 'Restablecer contraseña', body: 'Alguien pidió restablecer la contraseña de {email}. Haz clic para elegir una nueva.', cta: 'Elegir nueva contraseña', foot: 'Este enlace caduca en 1 hora. Si no lo pediste, tu contraseña no cambia; ignora este correo.' },
    ja: { subject: 'Favie パスワードのリセット', preheader: 'Favie アカウントの新しいパスワードを設定します。', title: 'パスワードをリセット', body: '{email} のパスワードリセットがリクエストされました。下のボタンから新しいパスワードを設定してください。', cta: '新しいパスワードを設定', foot: 'このリンクは1時間有効です。リクエストしていない場合、パスワードは変更されません。' },
  },
  email_change: {
    en: { subject: 'Confirm your new email for Favie', preheader: 'Confirm the change of your Favie sign-in email.', title: 'Confirm your new email', body: 'You asked to change your Favie sign-in email from {email} to {newEmail}. Confirm to finish the change.', cta: 'Confirm new email', foot: 'If you did not request this change, reply to this email right away.' },
    'zh-CN': { subject: '确认你的 Favie 新邮箱', preheader: '确认更换 Favie 登录邮箱。', title: '确认新邮箱', body: '你申请将 Favie 登录邮箱从 {email} 更改为 {newEmail}。点击确认以完成更改。', cta: '确认新邮箱', foot: '如果这不是你的操作，请直接回复此邮件联系我们。' },
    'zh-TW': { subject: '確認你的 Favie 新電子郵件', preheader: '確認更換 Favie 登入電子郵件。', title: '確認新電子郵件', body: '你申請將 Favie 登入電子郵件從 {email} 更改為 {newEmail}。點擊確認以完成更改。', cta: '確認新電子郵件', foot: '如果這不是你的操作，請直接回覆此郵件聯絡我們。' },
    es: { subject: 'Confirma tu nuevo correo de Favie', preheader: 'Confirma el cambio de tu correo de acceso a Favie.', title: 'Confirma tu nuevo correo', body: 'Pediste cambiar tu correo de acceso a Favie de {email} a {newEmail}. Confirma para completar el cambio.', cta: 'Confirmar nuevo correo', foot: 'Si no solicitaste este cambio, responde a este correo de inmediato.' },
    ja: { subject: 'Favie の新しいメールアドレスを確認', preheader: 'Favie ログイン用メールアドレスの変更を確認します。', title: '新しいメールアドレスを確認', body: 'Favie のログイン用メールアドレスを {email} から {newEmail} に変更するリクエストがありました。確認して変更を完了してください。', cta: '新しいメールを確認', foot: 'この変更に覚えがない場合は、すぐにこのメールに返信してください。' },
  },
  invite: {
    en: { subject: 'You have been invited to Favie', preheader: 'Accept your invitation to Favie.', title: 'You are invited to Favie', body: 'You have been invited to manage a restaurant on Favie, the AI that runs Uber Eats and DoorDash every day. Accept the invitation to set your password and get started.', cta: 'Accept invitation', foot: 'This invitation expires in 24 hours.' },
    'zh-CN': { subject: '邀请你加入 Favie', preheader: '接受 Favie 的邀请。', title: '邀请你加入 Favie', body: '你被邀请在 Favie 上管理一家餐厅。Favie 每天替你打理 Uber Eats 和 DoorDash。点击接受邀请并设置密码。', cta: '接受邀请', foot: '邀请 24 小时内有效。' },
    'zh-TW': { subject: '邀請你加入 Favie', preheader: '接受 Favie 的邀請。', title: '邀請你加入 Favie', body: '你被邀請在 Favie 上管理一家餐廳。Favie 每天替你打理 Uber Eats 和 DoorDash。點擊接受邀請並設定密碼。', cta: '接受邀請', foot: '邀請 24 小時內有效。' },
    es: { subject: 'Te han invitado a Favie', preheader: 'Acepta tu invitación a Favie.', title: 'Estás invitado a Favie', body: 'Te han invitado a gestionar un restaurante en Favie, la IA que gestiona Uber Eats y DoorDash cada día. Acepta la invitación para crear tu contraseña y empezar.', cta: 'Aceptar invitación', foot: 'Esta invitación caduca en 24 horas.' },
    ja: { subject: 'Favie への招待', preheader: 'Favie への招待を受け入れましょう。', title: 'Favie に招待されました', body: 'Uber Eats と DoorDash を毎日運用する AI、Favie でレストランを管理するよう招待されました。招待を受け入れてパスワードを設定してください。', cta: '招待を受け入れる', foot: 'この招待は24時間有効です。' },
  },
  reauthentication: {
    en: { subject: 'Your Favie verification code', preheader: 'Use this code to confirm a sensitive change.', title: 'Confirm it is you', body: 'Enter this code in Favie to confirm the change you are making.', foot: 'The code expires in 5 minutes. If you did not request it, you can ignore this email.' },
    'zh-CN': { subject: '你的 Favie 验证码', preheader: '用此验证码确认敏感操作。', title: '确认是你本人', body: '请在 Favie 中输入此验证码，以确认你正在进行的更改。', foot: '验证码 5 分钟内有效。如果不是你本人请求的，请忽略此邮件。' },
    'zh-TW': { subject: '你的 Favie 驗證碼', preheader: '用此驗證碼確認敏感操作。', title: '確認是你本人', body: '請在 Favie 中輸入此驗證碼，以確認你正在進行的更改。', foot: '驗證碼 5 分鐘內有效。如果不是你本人請求的，請忽略此郵件。' },
    es: { subject: 'Tu código de verificación de Favie', preheader: 'Usa este código para confirmar un cambio sensible.', title: 'Confirma que eres tú', body: 'Introduce este código en Favie para confirmar el cambio que estás haciendo.', foot: 'El código caduca en 5 minutos. Si no lo solicitaste, ignora este correo.' },
    ja: { subject: 'Favie 認証コード', preheader: '重要な変更を確認するためのコードです。', title: '本人確認', body: '進行中の変更を確認するため、このコードを Favie に入力してください。', foot: 'コードは5分間有効です。リクエストしていない場合は無視してください。' },
  },
}

export function normalizeLocale(v: string | null | undefined): AuthLocale {
  const s = (v ?? '').toLowerCase()
  if (s.startsWith('zh')) return /tw|hk|hant/.test(s) ? 'zh-TW' : 'zh-CN'
  if (s.startsWith('es')) return 'es'
  if (s.startsWith('ja')) return 'ja'
  return 'en'
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function layout(c: Copy, v: Vars, opts: { escapeVars: boolean }) {
  const e = opts.escapeVars ? esc : (s: string) => s
  const cta = c.cta && v.link ? `
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px auto 8px;">
              <tr><td style="border-radius:999px;background:${BRAND.blue};">
                <a href="${v.link}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${c.cta}</a>
              </td></tr>
            </table>
            <p style="margin:0 0 4px;font-size:12px;color:${BRAND.muted};text-align:center;">${c.linkHint}</p>
            <p style="margin:0 0 20px;font-size:12px;color:${BRAND.muted};text-align:center;word-break:break-all;"><a href="${v.link}" style="color:${BRAND.blue};text-decoration:none;">${v.link}</a></p>` : ''
  const code = v.code ? `
            <p style="margin:24px 0 8px;font-size:13px;color:${BRAND.muted};text-align:center;">${c.codeLabel}</p>
            <p style="margin:0 0 20px;font-family:SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;letter-spacing:6px;font-weight:700;color:${BRAND.ink};text-align:center;">${v.code}</p>` : ''
  const sub = (s: string) => s.replace('{email}', `<b>${e(v.email)}</b>`).replace('{newEmail}', `<b>${e(v.newEmail ?? '')}</b>`)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.subject}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${c.preheader}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
        <tr><td style="padding:0 8px 18px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="vertical-align:middle;"><img src="${v.siteUrl}/logo.png" width="36" height="36" alt="${BRAND.name}" style="display:block;border-radius:10px;"></td>
            <td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-size:18px;font-weight:700;color:${BRAND.ink};">${BRAND.name}</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${BRAND.card};border-radius:24px;padding:36px 32px;font-family:${FONT};color:${BRAND.ink};">
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;">${c.title}</h1>
            <p style="margin:0;font-size:15px;line-height:1.7;">${sub(c.body)}</p>
            ${cta}${code}
            <hr style="border:0;border-top:1px solid ${BRAND.border};margin:8px 0 16px;">
            <p style="margin:0;font-size:12px;line-height:1.7;color:${BRAND.muted};">${c.foot}</p>
        </td></tr>
        <tr><td style="padding:18px 8px 0;font-family:${FONT};font-size:12px;color:${BRAND.muted};text-align:center;">
          ${BRAND.name} · ${c.tagline} · <a href="${v.siteUrl}" style="color:${BRAND.muted};">${v.siteUrl.replace(/^https?:\/\//, '')}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function copyFor(type: AuthEmailType, locale: AuthLocale): Copy {
  return { ...COPY[type][locale], ...COMMON[locale] }
}

/** One language, real values — what the Send Email Hook sends through Resend. */
export function renderAuthEmail(type: AuthEmailType, locale: AuthLocale, vars: Vars): { subject: string; html: string; text: string } {
  const c = copyFor(type, locale)
  const html = layout(c, vars, { escapeVars: true })
  const text = [c.title, '', c.body.replace('{email}', vars.email).replace('{newEmail}', vars.newEmail ?? ''), vars.link ? `\n${c.cta}: ${vars.link}` : '', vars.code ? `\n${c.codeLabel}: ${vars.code}` : '', '', c.foot].join('\n')
  return { subject: c.subject, html, text }
}

/**
 * Bilingual (EN + 简体) Go templates for Supabase's own mailer — the fallback when the hook is off. Body
 * copy of both languages is stacked; variables are Supabase's `{{ .X }}`.
 */
export function goTemplates(): Record<'confirmation' | 'magic_link' | 'recovery' | 'email_change' | 'invite' | 'reauthentication', { subject: string; html: string }> {
  const link = (type: string, next: string) => `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${encodeURIComponent(next)}`
  const both = (type: AuthEmailType, v: Vars): { subject: string; html: string } => {
    const en = copyFor(type, 'en'), zh = copyFor(type, 'zh-CN')
    const merged: Copy = {
      ...en,
      subject: `${en.subject} · ${zh.subject}`,
      title: `${en.title} · ${zh.title}`,
      body: `${en.body}<br><span style="color:${BRAND.muted}">${zh.body}</span>`,
      cta: en.cta ? `${en.cta} · ${zh.cta}` : undefined,
      foot: `${en.foot}<br>${zh.foot}`,
      linkHint: `${en.linkHint} · ${zh.linkHint}`,
      codeLabel: `${en.codeLabel} · ${zh.codeLabel}`,
      tagline: en.tagline,
    }
    return { subject: merged.subject, html: layout(merged, v, { escapeVars: false }) }
  }
  const base: Vars = { siteUrl: '{{ .SiteURL }}', email: '{{ .Email }}', newEmail: '{{ .NewEmail }}' }
  return {
    confirmation: both('signup', { ...base, link: link('signup', '/onboarding') }),
    magic_link: both('magiclink', { ...base, link: link('magiclink', '/dashboard') }),
    recovery: both('recovery', { ...base, link: link('recovery', '/reset-password') }),
    email_change: both('email_change', { ...base, link: link('email_change', '/dashboard') }),
    invite: both('invite', { ...base, link: link('invite', '/reset-password') }),
    reauthentication: both('reauthentication', { ...base, code: '{{ .Token }}' }),
  }
}
