import AdminLayout from "@/components/admin-layout";
import { Star } from "lucide-react";

export default function AdminReviews() {
  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
            <Star className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Reviews / Reputation</h1>
            <p className="text-sm text-muted-foreground">Review monitoring, response management, and sentiment trends</p>
          </div>
        </div>
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">This section is being set up by your account team.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
