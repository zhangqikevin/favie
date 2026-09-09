import { Nav } from '@/components/marketing/Nav'

export const metadata = { title: 'Privacy Policy — Favie' }

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="bg-ink-900 pb-16 pt-28 text-white">
        <Nav />
        <div className="container-x"><h1 className="font-display text-4xl font-bold tracking-tight">Privacy Policy</h1><p className="mt-2 text-white/70">Last updated September 8, 2026 · Draft for review</p></div>
      </div>
      <article className="container-x prose prose-slate max-w-3xl py-14">
        <p><strong>This is a working draft. Have it reviewed by counsel before launch.</strong></p>
        <h2>What we collect</h2>
        <p>Your account details (name, email), your restaurant's details, payment information processed by Stripe (we never store card numbers), and the store, order, advertising, and review data made available through your Uber Eats and DoorDash merchant accounts and our data partners.</p>
        <h2>How we use it</h2>
        <p>To operate the Service: deciding and executing daily changes on your platform accounts, showing you what was done and why, and billing you.</p>
        <h2>Who we share it with</h2>
        <p>Service providers that run the Service on our behalf (hosting, payments, the AI agent platform, data providers). We do not sell your data.</p>
        <h2>Retention and deletion</h2>
        <p>We keep your data while your account is active and for up to 90 days after cancellation, then delete it. Email hello@favie.us to request deletion sooner.</p>
      </article>
    </main>
  )
}
