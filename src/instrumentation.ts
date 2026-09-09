/** Next.js server start hook: load sysadmin settings so the first ZooWork call already uses the DB key. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prepareZoowork } = await import('@/lib/zoowork/client')
    await prepareZoowork()
  }
}
