import Link from 'next/link'
import { getT } from '@/i18n/server'

/** Loud, unmissable: the numbers on this page are illustrative because the restaurant has no order-data source yet. */
export async function SampleDataNotice({ restaurantId }: { restaurantId: string }) {
  const { t } = await getT()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="max-w-3xl leading-relaxed">{t('data.sampleBanner')}</p>
      <Link href={`/dashboard/${restaurantId}/settings`} className="rounded-full bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800">{t('data.sampleBanner.link')}</Link>
    </div>
  )
}
