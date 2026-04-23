import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/chat-markdown";
import { apiRequest } from "@/lib/queryClient";
import {
  Send, Utensils, Zap, ChevronDown, CheckCircle2,
  Store, AlertCircle, ExternalLink, ArrowLeft,
} from "lucide-react";
import { SiUbereats } from "react-icons/si";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string;
  role: "ai" | "user";
  text: string;
}

interface UberEatsStore {
  store_id: string;
  name: string;
  location?: { street_address?: string; city?: string };
  status?: { is_accepting_orders?: boolean };
}

type PageState =
  | "checking-auth"
  | "not-logged-in"
  | "checking-ue"
  | "not-connected"
  | "loading-stores"
  | "select-store"
  | "ready"
  | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2); }
function nowStr() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const CHIPS = [
  "How are my UberEats ratings?",
  "What's slowing my order completion rate?",
  "Top 3 things to improve today",
  "Which menu items should I push?",
  "Why do customers leave bad reviews?",
];

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#06C167] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ─── Connect screen ───────────────────────────────────────────────────────────

function ConnectScreen({ errorParam }: { errorParam: string | null }) {
  const notConfigured = errorParam === "not_configured";
  const [copied, setCopied] = useState(false);

  const { data: redirectUriData } = useQuery<{ redirectUri: string }>({
    queryKey: ["/api/ubereats/redirect-uri"],
  });
  const redirectUri = redirectUriData?.redirectUri ?? "";

  const handleCopy = () => {
    if (redirectUri) {
      navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#06C167] flex items-center justify-center mx-auto mb-6">
          <SiUbereats className="w-8 h-8 text-white" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
          Connect UberEats
        </h1>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Link your UberEats merchant account so Favie can access your real restaurant data and give you live, personalized insights.
        </p>

        {/* Redirect URI info box — always show so user can register it */}
        {redirectUri && (
          <div className="p-4 rounded-xl bg-muted border border-border text-left mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Step 1 — Register this Redirect URI
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              In your <a href="https://developer.uber.com" target="_blank" rel="noopener noreferrer" className="underline">UberEats Developer app</a>, add this exact URL under "Redirect URIs":
            </p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground break-all">
                {redirectUri}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : "Copy"}
              </button>
            </div>
          </div>
        )}

        {notConfigured ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-left mb-5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 text-sm">
              UberEats API credentials are not yet configured. Please add <strong>UBEREATS_CLIENT_ID</strong> and <strong>UBEREATS_CLIENT_SECRET</strong> to the project secrets.
            </p>
          </div>
        ) : errorParam ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-left mb-5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">
              Authorization failed ({errorParam}). Make sure the redirect URI above is registered in your UberEats Developer app, then try again.
            </p>
          </div>
        ) : null}

        <a
          href="/api/ubereats/oauth/start"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#06C167] text-white font-semibold hover:bg-[#05A857] transition-colors"
          data-testid="button-connect-ubereats"
        >
          <SiUbereats className="w-4 h-4" />
          Step 2 — Connect with UberEats
        </a>

        <p className="text-muted-foreground text-xs mt-4">
          We only request read permissions. You can revoke access at any time.
        </p>
      </div>
    </div>
  );
}

// ─── Store selector ───────────────────────────────────────────────────────────

function StoreSelector({
  stores,
  onSelect,
}: {
  stores: UberEatsStore[];
  onSelect: (store: UberEatsStore) => void;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#06C167] flex items-center justify-center">
            <SiUbereats className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Choose a restaurant</h1>
            <p className="text-muted-foreground text-sm">Select which location to analyze</p>
          </div>
        </div>

        <div className="space-y-3">
          {stores.map((store) => (
            <button
              key={store.store_id}
              onClick={() => onSelect(store)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-[#06C167] hover:bg-[#06C167]/5 transition-all text-left group"
              data-testid={`button-store-${store.store_id}`}
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Store className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{store.name}</p>
                {store.location?.city && (
                  <p className="text-xs text-muted-foreground truncate">
                    {[store.location.street_address, store.location.city].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              {store.status?.is_accepting_orders != null && (
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                  store.status.is_accepting_orders
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-600"
                )}>
                  {store.status.is_accepting_orders ? "Open" : "Closed"}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Chat dashboard ───────────────────────────────────────────────────────────

function ChatDashboard({
  store,
  storeId,
  onChangeStore,
  showStoreSwitch,
}: {
  store: UberEatsStore | null;
  storeId: string;
  onChangeStore: () => void;
  showStoreSwitch: boolean;
}) {
  const restaurantName = store?.name ?? "Your Restaurant";
  const isOpen = store?.status?.is_accepting_orders;
  const city = [store?.location?.street_address, store?.location?.city].filter(Boolean).join(", ");

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "ai",
      text: `Hi! I'm Favie, your UberEats growth advisor for **${restaurantName}**. I have access to your real account data.\n\nWhat would you like to work on today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chipsUsed, setChipsUsed] = useState(false);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    setChipsUsed(true);

    const userMsg: ChatMsg = { id: makeId(), role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    historyRef.current = [
      ...historyRef.current,
      { role: "user", content: text.trim() },
    ];

    try {
      const data = await apiRequest("POST", "/api/ubereats/agent/chat", {
        messages: historyRef.current,
        storeId,
      });
      const reply = (data as any).text ?? "Sorry, I couldn't get a response. Please try again.";
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
      setMessages((prev) => [...prev, { id: makeId(), role: "ai", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "ai", text: "Something went wrong. Please try again." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, storeId]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top bar ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 h-16 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-muted-foreground hover-elevate transition-colors" title="Back to dashboard">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#06C167] flex items-center justify-center">
              <SiUbereats className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-serif font-bold text-foreground text-lg leading-none">{restaurantName}</span>
          </div>
          {city && <span className="text-muted-foreground text-xs hidden sm:block">{city}</span>}
        </div>

        <div className="flex items-center gap-3">
          {isOpen != null && (
            <span className={cn(
              "hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
              isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", isOpen ? "bg-green-500" : "bg-red-400")} />
              {isOpen ? "Accepting orders" : "Closed"}
            </span>
          )}
          {showStoreSwitch && (
            <Button variant="outline" size="sm" onClick={onChangeStore} data-testid="button-switch-store">
              <ChevronDown className="w-3.5 h-3.5 mr-1" /> Switch
            </Button>
          )}
        </div>
      </header>

      {/* ── Body: sidebar + chat ── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-16 sm:w-56 flex-shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 sm:p-4 pt-4">
            <p className="hidden sm:block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Your Agent
            </p>
            <div className="flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-xl bg-[#06C167]/10 border border-[#06C167]/20">
              <div className="w-8 h-8 rounded-xl bg-[#06C167] flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="text-sm font-semibold text-foreground">Favie</p>
                <p className="text-xs text-[#06C167] truncate flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Live UberEats data
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="p-3 sm:p-4 border-t border-border">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <SiUbereats className="w-3.5 h-3.5 text-[#06C167]" />
              Connected
            </div>
          </div>
        </aside>

        {/* Chat area */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                data-testid={`msg-${msg.role}-${msg.id}`}
              >
                {msg.role === "ai" && (
                  <div className="w-8 h-8 rounded-xl bg-[#06C167] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "ai"
                      ? "bg-card border border-border text-foreground"
                      : "bg-[#06C167] text-white"
                  )}
                >
                  {msg.role === "ai" ? <ChatMarkdown text={msg.text} /> : msg.text}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-[#06C167] flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Chips */}
          {!chipsUsed && (
            <div className="px-4 sm:px-6 pb-3 flex flex-wrap gap-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-[#06C167] hover:text-[#06C167] transition-colors"
                  data-testid={`chip-${chip.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 px-4 sm:px-6 pb-6">
            <div className="flex items-end gap-3 p-3 rounded-2xl border border-border bg-card focus-within:border-[#06C167] transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Favie anything about your UberEats performance…"
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-h-[36px] max-h-[160px]"
                style={{ fieldSizing: "content" } as any}
                data-testid="input-chat"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className="w-9 h-9 rounded-xl bg-[#06C167] flex items-center justify-center flex-shrink-0 hover:bg-[#05A857] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="button-send"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Powered by real UberEats data · Favie AI
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function UberEatsLab() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const errorParam = searchParams.get("error");
  const connectedParam = searchParams.get("connected");

  const [pageState, setPageState] = useState<PageState>("checking-auth");
  const [selectedStore, setSelectedStore] = useState<UberEatsStore | null>(null);
  const [storesList, setStoresList] = useState<UberEatsStore[]>([]);

  // 1. Auth check
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLocation("/login?next=/ubereats-lab");
    } else {
      setPageState("checking-ue");
    }
  }, [user, authLoading, setLocation]);

  // 2. UberEats status check
  const { data: ueStatus, isLoading: ueLoading } = useQuery<{ connected: boolean; selectedStoreId?: string | null }>({
    queryKey: ["/api/ubereats/status"],
    enabled: pageState === "checking-ue" || connectedParam === "true",
  });

  // 3. React to UberEats status
  useEffect(() => {
    if (!ueStatus) return;
    if (!ueStatus.connected) {
      setPageState("not-connected");
    } else {
      setPageState("loading-stores");
    }
  }, [ueStatus]);

  // 4. Load stores when connected
  const { data: storesData, isLoading: storesLoading } = useQuery<{ stores: UberEatsStore[] }>({
    queryKey: ["/api/ubereats/stores"],
    enabled: pageState === "loading-stores" || pageState === "select-store" || pageState === "ready",
  });

  useEffect(() => {
    if (!storesData?.stores) return;
    const stores = storesData.stores;
    setStoresList(stores);
    if (stores.length === 0) {
      setPageState("error");
    } else if (stores.length === 1) {
      setSelectedStore(stores[0]);
      setPageState("ready");
    } else {
      // Multiple stores — check if one was previously selected
      const prevId = ueStatus?.selectedStoreId;
      const found = prevId ? stores.find((s) => s.store_id === prevId) : null;
      if (found) {
        setSelectedStore(found);
        setPageState("ready");
      } else {
        setPageState("select-store");
      }
    }
  }, [storesData, ueStatus]);

  const selectStoreMutation = useMutation({
    mutationFn: async (store: UberEatsStore) => {
      await apiRequest("PATCH", "/api/ubereats/stores/select", { storeId: store.store_id });
      return store;
    },
    onSuccess: (store) => {
      setSelectedStore(store);
      setPageState("ready");
      queryClient.invalidateQueries({ queryKey: ["/api/ubereats/status"] });
    },
  });

  // ── Loading states ──
  if (authLoading || pageState === "checking-auth" || pageState === "checking-ue" || ueLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#06C167] flex items-center justify-center animate-pulse">
            <SiUbereats className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Connecting to UberEats…</p>
        </div>
      </div>
    );
  }

  if (pageState === "not-logged-in") return null;

  if (pageState === "not-connected") {
    return <ConnectScreen errorParam={errorParam} />;
  }

  if (pageState === "loading-stores" || storesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#06C167] flex items-center justify-center animate-pulse">
            <Store className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Loading your restaurants…</p>
        </div>
      </div>
    );
  }

  if (pageState === "select-store") {
    return (
      <StoreSelector
        stores={storesList}
        onSelect={(store) => selectStoreMutation.mutate(store)}
      />
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">No stores found</h2>
          <p className="text-muted-foreground text-sm mb-6">
            We couldn't find any UberEats restaurants linked to your account. Make sure your merchant account has active stores.
          </p>
          <Button variant="outline" asChild>
            <a href="/dashboard">Back to Dashboard</a>
          </Button>
        </div>
      </div>
    );
  }

  // ready
  return (
    <ChatDashboard
      store={selectedStore}
      storeId={selectedStore?.store_id ?? ""}
      onChangeStore={() => setPageState("select-store")}
      showStoreSwitch={storesList.length > 1}
    />
  );
}
