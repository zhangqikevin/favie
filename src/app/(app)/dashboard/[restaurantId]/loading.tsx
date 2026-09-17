/** Shown the instant a dashboard link is clicked, while the server renders the page (data lives in another region). */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card h-28" />)}
      </div>
      <div className="card h-72" />
      <div className="card h-40" />
    </div>
  )
}
