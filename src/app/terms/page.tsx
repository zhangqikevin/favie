import { Nav } from '@/components/marketing/Nav'

export const metadata = { title: 'Terms of Service — Favie' }

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="bg-ink-900 pb-16 pt-28 text-white">
        <Nav />
        <div className="container-x"><h1 className="font-display text-4xl font-bold tracking-tight">Terms of Service</h1><p className="mt-2 text-white/70">Last updated September 8, 2026 · Draft for review</p></div>
      </div>
      <article className="container-x prose prose-slate max-w-3xl py-14">
        <p><strong>This is a working draft. Have it reviewed by counsel before launch.</strong></p>
        <h2>1. The service</h2>
        <p>Favie provides automated management of your restaurant's Uber Eats and DoorDash merchant accounts ("the Service") for a monthly fee per restaurant location.</p>
        <h2>2. Authorization</h2>
        <p>By adding Favie's operations account as a Manager on your platform accounts you authorize Favie to view store data and to create, edit, pause, or resume advertising campaigns and promotions within the monthly caps you set, and to change menu item availability and store status only to correct errors. Favie will not access payout, banking, tax, or account-security settings. You may revoke this authorization at any time by removing Favie's account from your platform accounts.</p>
        <h2>3. Fees and refunds</h2>
        <p>The Service is billed monthly in advance at $299 per restaurant location. You may cancel at any time. If you cancel within 30 days of your first payment, we will refund that payment in full. Subsequent payments are non-refundable.</p>
        <h2>4. Your responsibilities</h2>
        <p>You represent that you are authorized to manage the platform accounts you connect, that you will keep your platform accounts in good standing, and that you will comply with Uber Eats' and DoorDash's merchant terms.</p>
        <h2>5. No guarantee of results</h2>
        <p>Favie makes decisions using automated systems and the data available to it. We do not guarantee any particular order volume, revenue, or advertising return.</p>
        <h2>6. Limitation of liability</h2>
        <p>To the maximum extent permitted by law, Favie's aggregate liability arising from the Service is limited to the fees you paid in the three months preceding the claim.</p>
        <h2>7. Contact</h2>
        <p>hello@favie.us</p>
      </article>
    </main>
  )
}
