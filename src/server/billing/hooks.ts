/**
 * Called whenever billing state changes. In M2 this enqueues `reconcileSchedule` for every agent of
 * the restaurant so the ZooWork cron follows `computeDesiredEnabled`. Kept as a seam so the webhook
 * handler has no ZooWork dependency.
 */
export async function onBillingChanged(restaurantId: string) {
  const { enqueueReconcileSchedule } = await import('@/server/jobs/enqueue')
  await enqueueReconcileSchedule(restaurantId).catch((e) => {
    console.warn('[billing] enqueueReconcileSchedule failed', restaurantId, (e as Error).message)
  })
}
