import { useLongPress } from "@/hooks/use-long-press";

/**
 * Chat message bubble wrapper that triggers delete on long-press.
 * A native confirm() guards against accidental deletion after the 500ms hold.
 */
export function MessageBubble({
  children,
  className,
  onDelete,
  confirmText = "Delete this message?",
  "data-testid": dataTestId,
}: {
  children: React.ReactNode;
  className?: string;
  onDelete: () => void;
  confirmText?: string;
  "data-testid"?: string;
}) {
  const handlers = useLongPress(() => {
    if (window.confirm(confirmText)) onDelete();
  }, 500);

  return (
    <div
      className={className}
      data-testid={dataTestId}
      {...handlers}
    >
      {children}
    </div>
  );
}
