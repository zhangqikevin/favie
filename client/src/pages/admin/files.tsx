import AdminLayout from "@/components/admin-layout";
import { FileText, Image, Film, BarChart2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const CATEGORY_DISPLAY_KEYS: Record<string, string> = {
  Menu: "files_page.cat_menu",
  Delivery: "files_page.cat_delivery",
  Content: "files_page.cat_content",
  Reputation: "files_page.cat_reputation",
  Creators: "files_page.cat_creators",
  Retention: "files_page.cat_retention",
};

const files = [
  { id: 1, name: "Menu Assets – Golden Wok Q1 2026", type: "Images", category: "Menu", size: "4.2 MB", updated: "Mar 10, 2026", icon: Image },
  { id: 2, name: "Uber Eats Hero Images – Refresh Mar 2026", type: "Images", category: "Delivery", size: "2.8 MB", updated: "Mar 9, 2026", icon: Image },
  { id: 3, name: "Short Video Draft – Kitchen Clip 03", type: "Video", category: "Content", size: "48 MB", updated: "Mar 8, 2026", icon: Film },
  { id: 4, name: "Short Video Draft – Menu Highlight 02", type: "Video", category: "Content", size: "41 MB", updated: "Mar 7, 2026", icon: Film },
  { id: 5, name: "Reputation Report – February 2026", type: "PDF", category: "Reputation", size: "1.1 MB", updated: "Mar 3, 2026", icon: FileText },
  { id: 6, name: "Delivery Performance Summary – Feb 2026", type: "PDF", category: "Delivery", size: "0.9 MB", updated: "Mar 1, 2026", icon: BarChart2 },
  { id: 7, name: "Creator Shortlist – March 2026", type: "PDF", category: "Creators", size: "0.4 MB", updated: "Feb 28, 2026", icon: FileText },
  { id: 8, name: "Loyalty Program Design Brief", type: "PDF", category: "Retention", size: "0.7 MB", updated: "Feb 20, 2026", icon: FileText },
];

const categoryColor: Record<string, string> = {
  Menu: "bg-orange-100 text-orange-700",
  Delivery: "bg-blue-100 text-blue-700",
  Content: "bg-purple-100 text-purple-700",
  Reputation: "bg-amber-100 text-amber-700",
  Creators: "bg-pink-100 text-pink-700",
  Retention: "bg-green-100 text-green-700",
};

export default function AdminFiles() {
  const { t } = useTranslation();
  return (
    <AdminLayout>
      <div className="border-b border-border bg-card px-6 py-5">
        <h1 className="font-serif text-2xl font-bold text-foreground">{t("files_page.title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("files_page.subtitle")}</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b border-border bg-muted/40">
            <span className="col-span-5">{t("files_page.col_name")}</span>
            <span className="col-span-2">{t("files_page.col_category")}</span>
            <span className="col-span-2">{t("files_page.col_type")}</span>
            <span className="col-span-2">{t("files_page.col_updated")}</span>
            <span className="col-span-1" />
          </div>
          {files.map((file, idx) => {
            const Icon = file.icon;
            return (
              <div
                key={file.id}
                className={cn("grid grid-cols-1 sm:grid-cols-12 items-center gap-2 sm:gap-0 px-5 py-4", idx < files.length - 1 && "border-b border-border")}
                data-testid={`row-file-${file.id}`}
              >
                <div className="sm:col-span-5 flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground leading-tight">{file.name}</p>
                    <p className="text-sm text-muted-foreground sm:hidden">{file.category} · {file.size}</p>
                  </div>
                </div>
                <div className="sm:col-span-2 hidden sm:block">
                  <span className={cn("text-sm font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide", categoryColor[file.category] ?? "bg-muted text-muted-foreground")}>
                    {t(CATEGORY_DISPLAY_KEYS[file.category] ?? file.category, { defaultValue: file.category })}
                  </span>
                </div>
                <div className="sm:col-span-2 hidden sm:block text-sm text-muted-foreground">{file.type}</div>
                <div className="sm:col-span-2 hidden sm:block text-sm text-muted-foreground">{file.updated}</div>
                <div className="sm:col-span-1 flex justify-end">
                  <button className="p-1.5 rounded hover:bg-muted transition-colors" data-testid={`button-download-${file.id}`}>
                    <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
