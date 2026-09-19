/** One restaurant. The yearly plan is billed once a year at eleven months' price (one month free). */
export const MONTHLY_USD = 299
export const YEARLY_MONTHS_CHARGED = 11
export const YEARLY_USD = MONTHLY_USD * YEARLY_MONTHS_CHARGED // 3,289
export const YEARLY_PER_MONTH_USD = Math.round(YEARLY_USD / 12) // 274
