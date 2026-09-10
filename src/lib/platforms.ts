import type { Platform } from '@/lib/db/schema'

/** Every delivery platform Favie shows. `supported` = Favie can connect and operate it today. */
export type PlatformId = Platform | 'hungrypanda' | 'fantuan'
export interface PlatformMeta { id: PlatformId; label: string; supported: boolean }

export const PLATFORM_CATALOG: PlatformMeta[] = [
  { id: 'uber_eats', label: 'Uber Eats', supported: true },
  { id: 'doordash', label: 'DoorDash', supported: true },
  { id: 'hungrypanda', label: 'HungryPanda 熊猫外卖', supported: false },
  { id: 'fantuan', label: 'Fantuan 饭团外卖', supported: false },
]
