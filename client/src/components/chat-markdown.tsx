import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function ChatMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("chat-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="opacity-70">{children}</del>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          h1: ({ children }) => <p className="font-semibold text-foreground mb-1.5 mt-1 first:mt-0">{children}</p>,
          h2: ({ children }) => <p className="font-semibold text-foreground mb-1.5 mt-1 first:mt-0">{children}</p>,
          h3: ({ children }) => <p className="font-semibold text-foreground mb-1 mt-1 first:mt-0">{children}</p>,
          h4: ({ children }) => <p className="font-semibold text-foreground mb-1 mt-1 first:mt-0">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary hover:opacity-80 break-words"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-muted text-foreground rounded px-1 py-0.5 text-xs font-mono break-words">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted text-foreground rounded-lg p-3 mb-2 overflow-x-auto text-xs font-mono leading-relaxed">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic mb-2">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
          th: ({ children }) => <th className="text-left font-semibold px-2 py-1.5 border-b border-border">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1.5 align-top">{children}</td>,
          img: ({ src, alt }) => {
            const url = typeof src === "string" ? src : "";
            if (/\.(?:mp4|webm|mov|m4v)(?:\?|#|$)/i.test(url)) {
              return (
                <video
                  src={url}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-w-full rounded-lg my-2"
                  aria-label={alt || undefined}
                />
              );
            }
            return <img src={url} alt={alt || ""} className="max-w-full rounded-lg my-2" />;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
