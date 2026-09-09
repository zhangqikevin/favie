import type { Platform } from '@/lib/db/schema'

export interface DateRange { start: string; end: string } // store-local business days, YYYY-MM-DD inclusive

export interface ZoodataRestaurant { restaurantId: string; name: string; timezone: string; platformBindings: { platform: string; platformStoreId: string }[] }

/** One row per platform (plus "ALL") for a range — restaurant_v2_channel_economics. */
export interface ChannelRow {
  platform: string; orderCnt: number; validOrderCnt: number; gmvAmount: number; netRevenueAmount: number | null
  commissionAmount: number | null; discountAmount: number | null; refundCnt: number | null; refundAmount: number | null; aovAmount: number | null; currency: string
}

/** One row per store × platform × day — restaurant_v2_platform_daily. Money in cents; nulls mean "not provided". */
export interface PlatformDailyRow {
  date: string; platform: 'doordash' | 'ubereats' | string; storeId?: string; isMature?: boolean
  rating?: number | null; downtimeMinutes?: number | null; adSpendAmount?: number | null; adAttributedOrderCnt?: number | null; adAttributedSalesAmount?: number | null
  platformReportedSalesAmount?: number | null; orderCnt?: number | null; errorCnt?: number | null; cancelCnt?: number | null
  raw: Record<string, unknown>
}

/**
 * One row per store × platform × day — restaurant_v2_platform_health. Order-side figures come from the
 * order feed (fresh, even before the portal reports), platform* figures from the merchant portal.
 */
export interface PlatformHealthRow {
  date: string; platform: 'doordash' | 'ubereats' | string; storeId?: string; isMature?: boolean
  ordersCnt: number | null; ordersGmvAmount: number | null; adAttributedOrdersCnt: number | null; adAttributedGmvAmount: number | null
  platformOrderVolume: number | null; platformSalesAmount: number | null; platformAdSpendAmount: number | null; platformAdRoas: number | null
  raw: Record<string, unknown>
}

export interface ZoodataClient {
  listRestaurants(): Promise<ZoodataRestaurant[]>
  getChannelEconomics(range: DateRange): Promise<ChannelRow[]>
  getPlatformDaily(range: DateRange, platform?: 'doordash' | 'ubereats'): Promise<PlatformDailyRow[]>
  getPlatformHealth(range: DateRange): Promise<PlatformHealthRow[]>
}

export const toZoodataPlatform = (p: Platform): 'doordash' | 'ubereats' => (p === 'doordash' ? 'doordash' : 'ubereats')
export const fromZoodataPlatform = (p: string): Platform | null => (p === 'doordash' ? 'doordash' : p === 'ubereats' ? 'uber_eats' : null)
