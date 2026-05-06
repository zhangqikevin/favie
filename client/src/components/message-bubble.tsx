import { useLongPress } from "@/hooks/use-long-press";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chat message bubble wrapper.
 * - Long-press (500ms) → triggers `onLongPress`. The parent typically uses this
 *   to enter multi-select mode and pre-selects the long-pressed message.
 * - In `selectMode`, a tap toggles selection via `onToggleSelect`, and the
 *   bubble shows a selection ring + corner check badge.
 */
export function MessageBubble({
  children,
  className,
  selectMode = false,
  selected = false,
  onLongPress,
  onToggleSelect,
  "data-testid": dataTestId,
}: {
  children: React.ReactNode;
  className?: string;
  selectMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
  "data-testid"?: string;
}) {
  const longPressHandlers = useLongPress(() => onLongPress?.(), 500);

  return (
    <div className="relative inline-block max-w-full text-left">
      <div
        className={cn(
          className,
          "transition-all",
          selectMode && "cursor-pointer",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        data-testid={dataTestId}
        onClick={selectMode ? onToggleSelect : undefined}
        {...(selectMode ? {} : longPressHandlers)}
      >
        {children}
      </div>
      {selectMode && (
        <div
          className={cn(
            "absolute -top-2 -right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center pointer-events-none transition-colors",
            selected
              ? "bg-primary border-primary text-primary-foreground"
              : "bg-background border-border",
          )}
          data-testid={selected ? "msg-checkbox-selected" : "msg-checkbox-unselected"}
        >
          {selected && <Check className="w-3 h-3" strokeWidth={3} />}
        </div>
      )}
    </div>
  );
}
