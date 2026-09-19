'use client'
import { useState } from 'react'
import { useT } from '@/i18n/client'
import { SubmitButton } from '@/components/SubmitButton'
import { MONTHLY_USD, YEARLY_USD, YEARLY_PER_MONTH_USD } from '@/lib/pricing'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

/**
 * Monthly or yearly (11 months' price). Both are shown as a price PER MONTH — the yearly one is simply the
 * lower monthly price you get when paying for the year up front. The chosen plan goes to checkout as a hidden field.
 */
export function PlanPicker({ action, yearlyAvailable }: { action: (fd: FormData) => void | Promise<void>; yearlyAvailable: boolean }) {
  const t = useT()
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly')
  const yearly = plan === 'yearly'
  return (
    <form action={action}>
      <input type="hidden" name="plan" value={plan} />
      {yearlyAvailable && (
        <div role="radiogroup" aria-label={t('ob.billing.plan')} className="mb-5 grid grid-cols-2 gap-2">
          {(['monthly', 'yearly'] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={plan === p} onClick={() => setPlan(p)}
              className={`relative rounded-2xl border px-3 py-3 text-left transition-colors ${plan === p ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300'}`}>
              <span className="block text-sm font-semibold">{t(p === 'monthly' ? 'ob.billing.monthly' : 'ob.billing.yearly')}</span>
              <span className="mt-1 block text-base font-semibold tabular-nums">{usd(p === 'monthly' ? MONTHLY_USD : YEARLY_PER_MONTH_USD)}<span className="text-xs font-normal text-ink-500">{t('common.month')}</span></span>
              <span className="mt-0.5 block text-xs text-ink-500">{p === 'monthly' ? t('ob.billing.monthly.sub') : t('ob.billing.yearly.sub')}</span>
              {p === 'yearly' && <span className="absolute -top-2 right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">{t('ob.billing.yearly.badge')}</span>}
            </button>
          ))}
        </div>
      )}
      <p className="text-sm text-ink-500">{t('common.perRestaurant')}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-5xl font-bold tracking-tight tabular-nums">{usd(yearly ? YEARLY_PER_MONTH_USD : MONTHLY_USD)}</span>
        <span className="text-ink-500">{t('common.month')}</span>
      </div>
      <p className="mt-2 text-xs text-ink-500">{yearly ? t('ob.billing.yearly.today', { price: usd(YEARLY_USD), saved: usd(MONTHLY_USD) }) : t('ob.billing.monthly.today', { price: usd(MONTHLY_USD) })}</p>
      <SubmitButton className="btn-primary mt-6 w-full !py-3.5">{t('ob.billing.pay')}</SubmitButton>
    </form>
  )
}
