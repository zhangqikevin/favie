import { redirect } from 'next/navigation'
import { requireUser, getPrimaryRestaurant } from '@/server/auth'
import { getSubscription } from '@/server/restaurants'
import { OnboardingShell } from '../OnboardingShell'
import { startCheckout, devSkipBilling } from '../actions'
import { getT } from '@/i18n/server'

export default async function BillingStep({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser()
  const r = await getPrimaryRestaurant(user.id)
  if (!r) redirect('/onboarding')
  if (r.onboardingStep !== 'billing') redirect(`/onboarding/${r.onboardingStep === 'done' ? '' : r.onboardingStep}`)
  const sub = await getSubscription(r.id)
  const { checkout } = await searchParams
  const { t } = await getT()
  // Webhook may lag the redirect back from Stripe; if the subscription is already active, move on.
  if (sub?.status === 'active') redirect('/onboarding/connect')

  return (
    <OnboardingShell step="billing" title={t('ob.billing.title')} subtitle={t('ob.billing.subtitle')}>
      <div className="grid gap-6 md:grid-cols-5">
        <div className="card p-7 md:col-span-3">
          <h2 className="font-display text-lg font-bold">{t('ob.billing.next')}</h2>
          <ol className="mt-4 space-y-3 text-sm text-ink-700">
            <li className="flex gap-3"><span className="font-semibold text-brand-600">1.</span> {t('ob.billing.s1')}</li>
            <li className="flex gap-3"><span className="font-semibold text-brand-600">2.</span> {t('ob.billing.s2')}</li>
            <li className="flex gap-3"><span className="font-semibold text-brand-600">3.</span> {t('ob.billing.s3')}</li>
            <li className="flex gap-3"><span className="font-semibold text-brand-600">4.</span> {t('ob.billing.s4')}</li>
          </ol>
          {checkout === 'cancelled' && (
            <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('ob.billing.cancelled')}</p>
          )}
          {checkout === 'success' && (
            <p className="mt-5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t('ob.billing.success')}</p>
          )}
        </div>
        <div className="card p-7 md:col-span-2">
          <p className="text-sm text-ink-500">{t('common.perRestaurant')}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display text-5xl font-bold tracking-tight">$299</span>
            <span className="text-ink-500">{t('common.month')}</span>
          </div>
          <form action={startCheckout} className="mt-6">
            <button type="submit" className="btn-primary w-full !py-3.5">{t('ob.billing.pay')}</button>
          </form>
          <p className="mt-3 text-center text-xs text-ink-500">{t('ob.billing.guarantee')}</p>
          {process.env.FAVIE_SKIP_BILLING === '1' && (
            <form action={devSkipBilling} className="mt-4 border-t border-dashed border-ink-100 pt-4">
              <button type="submit" className="btn-secondary w-full !py-2 text-xs">{t('ob.billing.devSkip')}</button>
            </form>
          )}
        </div>
      </div>
    </OnboardingShell>
  )
}
