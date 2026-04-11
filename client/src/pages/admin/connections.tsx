import AdminLayout from "@/components/admin-layout";
import { CheckCircle2, AlertCircle, Circle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const connections = [
  {
    id: "ubereats",
    name: "Uber Eats",
    category: "Delivery",
    status: "connected",
    detail: "Storefront + Ads · Last sync 2 hrs ago",
  },
  {
    id: "doordash",
    name: "DoorDash",
    category: "Delivery",
    status: "connected",
    detail: "Storefront + Ads · Last sync 2 hrs ago",
  },
  {
    id: "instagram",
    name: "Instagram",
    category: "Social",
    status: "connected",
    detail: "Content publishing active · @goldenwok_dtw",
  },
  {
    id: "tiktok",
    name: "TikTok",
    category: "Social",
    status: "connected",
    detail: "Short video publishing active · @goldenwok",
  },
  {
    id: "google",
    name: "Google Business Profile",
    category: "Reputation",
    status: "connected",
    detail: "Review monitoring active · Last sync 6 hrs ago",
  },
  {
    id: "yelp",
    name: "Yelp",
    category: "Reputation",
    status: "warning",
    detail: "Re-authentication required",
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    category: "CRM / Email",
    status: "connected",
    detail: "Retention campaigns active · 2,840 contacts synced",
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "Messaging",
    status: "disconnected",
    detail: "Not connected",
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    category: "Analytics",
    status: "disconnected",
    detail: "Not connected",
  },
];

function StatusIcon({ status }: { status: string }) {
  if (status === "connected") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === "warning") return <AlertCircle className="w-4 h-4 text-amber-500" />;
  return <Circle className="w-4 h-4 text-muted-foreground" />;
}

function StatusLabel({ status }: { status: string }) {
  if (status === "connected") return <span className="text-sm font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Connected</span>;
  if (status === "warning") return <span className="text-sm font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Action needed</span>;
  return <span className="text-sm font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Not connected</span>;
}

const categoryColor: Record<string, string> = {
  Delivery: "bg-blue-100 text-blue-700",
  Social: "bg-purple-100 text-purple-700",
  Reputation: "bg-amber-100 text-amber-700",
  "CRM / Email": "bg-green-100 text-green-700",
  Analytics: "bg-orange-100 text-orange-700",
  Messaging: "bg-sky-100 text-sky-700",
};

export default function AdminConnections() {
  return (
    <AdminLayout>
      <div className="border-b border-border bg-card px-6 py-5">
        <h1 className="font-serif text-2xl font-bold text-foreground">Connections</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform integrations the AI uses to manage your growth channels.</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {connections.map((conn) => (
            <div key={conn.id} className="flex items-center gap-4 px-5 py-4" data-testid={`row-connection-${conn.id}`}>
              <StatusIcon status={conn.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground">{conn.name}</span>
                  <span className={cn("text-sm font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide", categoryColor[conn.category] ?? "bg-muted text-muted-foreground")}>
                    {conn.category}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{conn.detail}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <StatusLabel status={conn.status} />
                {conn.status !== "disconnected" && (
                  <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid={`button-manage-${conn.id}`}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
