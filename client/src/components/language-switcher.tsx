import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export const LANGUAGES = [
  { code: "en",    labelKey: "lang.en"   },
  { code: "zh-CN", labelKey: "lang.zhCN" },
  { code: "zh-TW", labelKey: "lang.zhTW" },
  { code: "es",    labelKey: "lang.es"   },
] as const;

interface Props {
  className?: string;
  /** "light" = white text (for dark backgrounds), "default" = muted text */
  variant?: "light" | "default";
}

export default function LanguageSwitcher({ className, variant = "default" }: Props) {
  const { i18n, t } = useTranslation();

  const currentCode = i18n.language;

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      <Globe
        className={cn(
          "w-3.5 h-3.5 flex-shrink-0",
          variant === "light" ? "text-white/50" : "text-muted-foreground"
        )}
      />
      {LANGUAGES.map((lang) => {
        const active = currentCode === lang.code;
        return (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={cn(
              "text-xs px-2 py-1 rounded-md transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : variant === "light"
                  ? "text-white/50 hover:text-white hover:bg-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            data-testid={`button-lang-${lang.code}`}
          >
            {t(lang.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
