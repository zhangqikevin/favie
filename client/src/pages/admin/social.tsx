import AdminLayout from "@/components/admin-layout";
import { Share2 } from "lucide-react";

export default function AdminSocial() {
  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
            <Share2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Social Media</h1>
            <p className="text-sm text-muted-foreground">Content calendar, publishing schedule, and audience engagement</p>
          </div>
        </div>
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">This section is being set up by your account team.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
