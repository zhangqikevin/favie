import { Utensils } from "lucide-react";

export default function ThinkingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex items-center gap-2.5 mb-6">
        <Utensils className="w-6 h-6 text-primary" />
        <span className="font-serif font-bold text-2xl text-foreground">Favie</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Thinking</span>
        <span className="flex gap-1 ml-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}
