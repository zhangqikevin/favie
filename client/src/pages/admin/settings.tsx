import { useState, useEffect, Fragment } from "react";
import { useAuth } from "@/lib/auth-context";
import AdminLayout from "@/components/admin-layout";
import {
  User, Users, Bell, CreditCard, Shield, CheckCircle2, AlertCircle,
  Circle, Building2, Plus, Trash2, Loader2, MapPin, ChevronDown, ChevronRight, Link2,
  Settings2, Lock, Eye, EyeOff, Save, Bot, ChevronUp, Globe, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SiUbereats, SiDoordash, SiInstagram, SiTiktok, SiGoogle, SiYelp, SiTelegram } from "react-icons/si";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import RestaurantSetupFlow from "@/components/restaurant-setup-flow";
import type { Restaurant } from "@shared/schema";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/language-switcher";

// ─── Connections data ──────────────────────────────────────────────────────────

const CONNECTIONS = [
  {
    id: "ubereats",
    name: "Uber Eats",
    detail: "Storefront + Ads",
    detailKey: "settings.conn_storefront_ads",
    category: "Delivery",
    status: "connected",
    icon: SiUbereats,
    iconBg: "bg-[#06C167]/10",
    iconColor: "#06C167",
  },
  {
    id: "doordash",
    name: "DoorDash",
    detail: "Storefront + Ads",
    detailKey: "settings.conn_storefront_ads",
    category: "Delivery",
    status: "connected",
    icon: SiDoordash,
    iconBg: "bg-[#FF3008]/10",
    iconColor: "#FF3008",
  },
  {
    id: "instagram",
    name: "Instagram",
    detail: "@goldenwok_dtw",
    category: "Social",
    status: "connected",
    icon: SiInstagram,
    iconBg: "bg-pink-50",
    iconColor: "#E1306C",
  },
  {
    id: "tiktok",
    name: "TikTok",
    detail: "@goldenwok",
    category: "Social",
    status: "connected",
    icon: SiTiktok,
    iconBg: "bg-slate-100",
    iconColor: "#000000",
  },
  {
    id: "google",
    name: "Google Business",
    detail: "Review monitoring active",
    detailKey: "settings.conn_review_monitoring",
    category: "Reputation",
    status: "connected",
    icon: SiGoogle,
    iconBg: "bg-blue-50",
    iconColor: "#4285F4",
  },
  {
    id: "yelp",
    name: "Yelp",
    detail: "Re-authentication required",
    detailKey: "settings.conn_reauth_required",
    category: "Reputation",
    status: "warning",
    icon: SiYelp,
    iconBg: "bg-red-50",
    iconColor: "#D32323",
  },
  {
    id: "telegram",
    name: "Telegram",
    detail: "Not connected",
    detailKey: "settings.conn_not_connected",
    category: "Messaging",
    status: "disconnected",
    icon: SiTelegram,
    iconBg: "bg-sky-50",
    iconColor: "#229ED9",
  },
];

function ConnectionCard({ conn }: { conn: typeof CONNECTIONS[0] }) {
  const { t } = useTranslation();
  const Icon = conn.icon;
  return (
    <div
      className="flex items-center gap-3 bg-background rounded-xl border border-border p-3"
      data-testid={`card-connection-${conn.id}`}
    >
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", conn.iconBg)}>
        <Icon size={18} color={conn.iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{conn.name}</p>
        <p className="text-sm text-muted-foreground mt-0.5 truncate">{conn.detailKey ? t(conn.detailKey) : conn.detail}</p>
      </div>
      <div className="flex-shrink-0">
        {conn.status === "connected" && (
          <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-sm font-semibold">{t("settings.status_connected")}</span>
          </div>
        )}
        {conn.status === "warning" && (
          <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />
            <span className="text-sm font-semibold">{t("settings.status_action_needed")}</span>
          </div>
        )}
        {conn.status === "disconnected" && (
          <div className="flex items-center gap-1 bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            <Circle className="w-3 h-3" />
            <span className="text-sm font-semibold">{t("settings.status_not_connected")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Restaurant Management ────────────────────────────────────────────────────

function RestaurantManagementSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ restaurants: Restaurant[] }>({
    queryKey: ["/api/restaurants"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/restaurants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
    },
  });

  const restaurants = data?.restaurants ?? [];
  const connectedCount = CONNECTIONS.filter(c => c.status === "connected").length;
  // ≤3 restaurants → always show connections inline; >3 → collapsible toggle
  const inlineConnections = restaurants.length <= 3;

  return (
    <div
      id="restaurants"
      className="bg-card border border-border rounded-xl overflow-hidden"
      data-testid="section-settings-restaurants"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">{t("settings.restaurants_title")}</span>
          {restaurants.length > 0 && (
            <span className="text-sm text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {restaurants.length}
            </span>
          )}
        </div>
        {!showAddForm && (
          <Button
            size="sm"
            variant="outline"
            className="text-sm gap-1.5"
            onClick={() => setShowAddForm(true)}
            data-testid="button-add-restaurant"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("settings.add_restaurant")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      ) : (
        <div>
          {restaurants.length === 0 && !showAddForm && (
            <div className="px-5 py-8 text-center">
              <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("settings.no_restaurants")}</p>
              <button
                className="text-sm text-primary hover:underline mt-1"
                onClick={() => setShowAddForm(true)}
              >
                {t("settings.add_first_restaurant")}
              </button>
            </div>
          )}

          {restaurants.length > 0 && (
            <ul className="divide-y divide-border">
              {restaurants.map((r) => {
                const isExpanded = expandedId === r.id;
                return (
                  <li key={r.id} data-testid={`item-restaurant-${r.id}`}>
                    {/* Restaurant row */}
                    <div className="flex items-center gap-3 px-5 py-3.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight">{r.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm text-muted-foreground truncate">{r.address}</p>
                        </div>
                        {r.rating && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            ★ {r.rating}
                            {r.reviewCount ? ` · ${r.reviewCount} reviews` : ""}
                          </p>
                        )}
                      </div>
                      {/* Connections toggle — only when >3 restaurants */}
                      {!inlineConnections && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted flex-shrink-0"
                          data-testid={`button-toggle-connections-${r.id}`}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{connectedCount} {t("settings.connections_label")}</span>
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                      {/* Delete */}
                      <button
                        onClick={() => deleteMutation.mutate(r.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10 flex-shrink-0"
                        title="Remove restaurant"
                        data-testid={`button-delete-restaurant-${r.id}`}
                      >
                        {deleteMutation.isPending
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </button>
                    </div>

                    {/* Connections panel — always visible when ≤3, else collapsible */}
                    {(inlineConnections || isExpanded) && (
                      <div className="border-t border-border bg-muted/30 px-5 py-4" data-testid={`panel-connections-${r.id}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-semibold text-foreground">{t("settings.connections_section")}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {connectedCount} {t("settings.of")} {CONNECTIONS.length} {t("settings.connected_count_label")}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {CONNECTIONS.map((conn) => (
                            <ConnectionCard key={conn.id} conn={conn} />
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {showAddForm && (
            <div className="px-5 py-5 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-foreground">{t("settings.add_new_restaurant")}</p>
                <button
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowAddForm(false)}
                >
                  {t("settings.cancel")}
                </button>
              </div>
              <RestaurantSetupFlow
                compact
                onComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
                  setTimeout(() => setShowAddForm(false), 1400);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── System Config ─────────────────────────────────────────────────────────────

const SYSTEM_CONFIG_PASSWORD = "123456";

const AGENT_IDS = ["operation", "chef", "social", "customer", "finance", "legal", "expert"] as const;
type AgentId = typeof AGENT_IDS[number];
const AGENT_LABELS: Record<AgentId, string> = {
  operation: "Operation Agent",
  chef:      "Chef Agent",
  social:    "Marketing Agent",
  customer:  "Customer Service Agent",
  finance:   "Finance Agent",
  legal:     "Legal & HR Agent",
  expert:    "Restaurant Expert",
};

type ConfigForm = Record<string, string>;

function AgentCard({ agentId, form, setForm, editing }: {
  agentId: AgentId;
  form: ConfigForm;
  setForm: React.Dispatch<React.SetStateAction<ConfigForm>>;
  editing: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const enabled = form[`agent_${agentId}_enabled`] !== "false";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Agent row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-background">
        <Bot className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1">{AGENT_LABELS[agentId]}</span>
        {editing ? (
          <Switch
            checked={enabled}
            onCheckedChange={(v) => setForm(f => ({ ...f, [`agent_${agentId}_enabled`]: v ? "true" : "false" }))}
          />
        ) : (
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", enabled ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
            {enabled ? t("settings.agent_enabled") : t("settings.agent_disabled")}
          </span>
        )}
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{t("settings.role_label")}</p>
            {editing ? (
              <Textarea
                value={form[`agent_${agentId}_role`] ?? ""}
                onChange={(e) => setForm(f => ({ ...f, [`agent_${agentId}_role`]: e.target.value }))}
                className="text-sm font-mono min-h-[80px] resize-y"
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {form[`agent_${agentId}_role`] || <span className="text-muted-foreground italic">{t("settings.using_default")}</span>}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{t("settings.conversation_rules")}</p>
            {editing ? (
              <Textarea
                value={form[`agent_${agentId}_rules`] ?? ""}
                onChange={(e) => setForm(f => ({ ...f, [`agent_${agentId}_rules`]: e.target.value }))}
                className="text-sm font-mono min-h-[140px] resize-y"
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {form[`agent_${agentId}_rules`] || <span className="text-muted-foreground italic">{t("settings.using_default")}</span>}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SystemConfigSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [unlocked, setUnlocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<ConfigForm>({});

  const { data: cfg, isLoading } = useQuery<ConfigForm>({
    queryKey: ["/api/system-config"],
    enabled: unlocked,
  });

  useEffect(() => {
    if (cfg) setForm(cfg);
  }, [cfg]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/system-config", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-config"] });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function handleUnlock() {
    if (pwInput === SYSTEM_CONFIG_PASSWORD) { setUnlocked(true); setPwError(""); }
    else setPwError(t("settings.incorrect_password"));
  }

  function handleCancel() {
    if (cfg) setForm(cfg);
    setEditing(false);
    setShowKey(false);
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="section-settings-system-config">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">{t("settings.system_config_title")}</span>
        </div>
        {!unlocked
          ? <Lock className="w-4 h-4 text-muted-foreground" />
          : !editing
            ? <Button size="sm" variant="outline" className="text-sm" onClick={() => setEditing(true)}>{t("settings.edit")}</Button>
            : null
        }
      </div>

      {/* Locked state */}
      {!unlocked ? (
        <div className="px-5 py-6">
          <p className="text-sm text-muted-foreground mb-3">{t("settings.enter_password_prompt")}</p>
          <div className="flex gap-2 max-w-xs">
            <Input
              type="password"
              placeholder={t("settings.password_placeholder")}
              value={pwInput}
              onChange={(e) => { setPwInput(e.target.value); setPwError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              className="text-sm"
            />
            <Button size="sm" onClick={handleUnlock}>{t("settings.unlock")}</Button>
          </div>
          {pwError && <p className="text-sm text-destructive mt-2">{pwError}</p>}
        </div>

      ) : isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>

      ) : (
        <div className="divide-y divide-border">

          {/* ── Agent Group ── */}
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("settings.section_agent")}</p>
            </div>

            {/* Per-agent cards */}
            <div className="space-y-2">
              {AGENT_IDS.map((id) => (
                <AgentCard key={id} agentId={id} form={form} setForm={setForm} editing={editing} />
              ))}
            </div>
          </div>

          {/* ── App Base URL Group ── */}
          <div className="px-5 py-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("settings.section_public_url")}</p>
            {!editing ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("settings.app_base_url")}</span>
                <span className="text-sm font-medium text-foreground font-mono truncate max-w-[260px]">
                  {form.app_base_url || <span className="text-muted-foreground italic font-sans">{t("settings.not_set")}</span>}
                </span>
              </div>
            ) : (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("settings.app_base_url")}</label>
                <Input
                  value={form.app_base_url ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, app_base_url: e.target.value }))}
                  placeholder="https://your-tunnel.trycloudflare.com"
                  className="text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">{t("settings.app_base_url_hint")}</p>
              </div>
            )}
          </div>

          {/* ── openclaw Group ── */}
          <div className="px-5 py-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("settings.section_openclaw")}</p>

            {!editing ? (
              <ul className="space-y-0 -mx-5 divide-y divide-border">
                <li className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-muted-foreground">{t("settings.base_url")}</span>
                  <span className="text-sm font-medium text-foreground font-mono truncate max-w-[260px]">
                    {form.openclaw_base_url || <span className="text-muted-foreground italic font-sans">{t("settings.not_set")}</span>}
                  </span>
                </li>
                <li className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-muted-foreground">{t("settings.api_key")}</span>
                  <span className="text-sm font-medium text-foreground font-mono">
                    {form.openclaw_api_key || <span className="text-muted-foreground italic font-sans">{t("settings.not_set")}</span>}
                  </span>
                </li>
              </ul>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t("settings.base_url")}</label>
                  <Input
                    value={form.openclaw_base_url ?? ""}
                    onChange={(e) => setForm(f => ({ ...f, openclaw_base_url: e.target.value }))}
                    placeholder="https://your-openclaw-host"
                    className="text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t("settings.api_key")}</label>
                  <Input
                    type="password"
                    value={form.openclaw_api_key ?? ""}
                    onChange={(e) => setForm(f => ({ ...f, openclaw_api_key: e.target.value }))}
                    placeholder="API key"
                    className="text-sm font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Action bar ── */}
          <div className="px-5 py-4 flex items-center gap-3">
            {editing ? (
              <>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1.5">
                  {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {t("settings.save_btn")}
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} disabled={saveMutation.isPending}>{t("settings.cancel")}</Button>
                {saveMutation.isError && <span className="text-sm text-destructive">{t("settings.save_failed")}</span>}
              </>
            ) : (
              <>
                {saved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {t("settings.saved_confirm")}</span>}
                <button className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setUnlocked(false); setPwInput(""); }}>
                  {t("settings.lock")}
                </button>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Openclaw Agent Mapping ───────────────────────────────────────────────────

function OpenclawAgentMappingSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);

  if (!user?.id) return null;

  const userPrefix = user.id.slice(0, 8);
  const mappings = AGENT_IDS.map((id) => ({
    favieId: id,
    favieLabel: AGENT_LABELS[id],
    ocAgentId: `${userPrefix}-${id}`,
  }));

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      data-testid="section-settings-openclaw-agents"
    >
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <Bot className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm text-foreground">{t("settings.openclaw_agents_title")}</span>
      </div>
      <div className="px-5 py-4">
        <ul className="divide-y divide-border">
          {mappings.map(({ favieId, favieLabel, ocAgentId }) => {
            const isCopied = copied === ocAgentId;
            return (
              <li
                key={favieId}
                className="flex items-center justify-between gap-3 py-2.5"
                data-testid={`row-openclaw-mapping-${favieId}`}
              >
                <span className="text-sm font-medium text-foreground flex-shrink-0">{favieLabel}</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-sm font-mono text-muted-foreground truncate"
                    data-testid={`text-openclaw-id-${favieId}`}
                  >
                    {ocAgentId}
                  </span>
                  <button
                    onClick={() => handleCopy(ocAgentId)}
                    className="p-1 text-muted-foreground hover-elevate active-elevate-2 rounded-md flex-shrink-0"
                    title={isCopied ? t("settings.openclaw_agents_copied") : t("settings.openclaw_agents_copy")}
                    data-testid={`button-copy-openclaw-id-${favieId}`}
                  >
                    {isCopied
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ─── Settings sections ─────────────────────────────────────────────────────────

// Sections are built inside the component using t() for i18n

export default function AdminSettings() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const sections = [
    {
      id: "account",
      icon: User,
      title: t("settings.section_account"),
      fields: [
        { label: t("settings.field_email"), value: user?.email ?? "—" },
        { label: t("settings.field_role"), value: "Owner" },
      ],
    },
    {
      id: "approvals",
      icon: Shield,
      title: t("settings.section_approvals"),
      fields: [
        { label: t("settings.field_new_promotions"), value: t("settings.val_require_approval") },
        { label: t("settings.field_budget_changes"), value: "$500" },
        { label: t("settings.field_content_publishing"), value: t("settings.val_auto_approve") },
        { label: t("settings.field_influencer_outreach"), value: t("settings.val_require_approval") },
      ],
    },
    {
      id: "notifications",
      icon: Bell,
      title: t("settings.section_notifications"),
      fields: [
        { label: t("settings.field_weekly_summary"), value: t("settings.val_email_monday") },
        { label: t("settings.field_approval_requests"), value: t("settings.val_email_in_app") },
        { label: t("settings.field_spend_alerts"), value: t("settings.val_spend_alert") },
        { label: t("settings.field_review_alerts"), value: t("settings.val_review_alert") },
      ],
    },
    {
      id: "team",
      icon: Users,
      title: t("settings.section_team"),
      fields: [
        { label: user?.email ?? "—", value: "Owner" },
      ],
    },
    {
      id: "billing",
      icon: CreditCard,
      title: t("settings.section_billing"),
      fields: [
        { label: t("settings.field_active_plan"), value: "Growth Retainer · $299/mo" },
        { label: t("settings.field_next_billing"), value: "April 1, 2026" },
        { label: t("settings.field_payment_method"), value: "Visa ending in 4242" },
      ],
    },
  ];

  return (
    <AdminLayout>
      <div className="border-b border-border bg-card px-6 py-5">
        <h1 className="font-serif text-2xl font-bold text-foreground">{t("settings.page_title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings.page_subtitle")}</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 pb-16">

        {/* Restaurant Management — connections nested per restaurant */}
        <RestaurantManagementSection />

        {/* Language & Region */}
        <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="section-settings-language">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm text-foreground">{t("settings.language_section")}</span>
          </div>
          <div className="px-5 py-5 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-3">{t("settings.language_desc")}</p>
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        {/* All other settings sections */}
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Fragment key={section.id}>
              <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`section-settings-${section.id}`}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm text-foreground">{section.title}</span>
                  </div>
                  <Button size="sm" variant="outline" className="text-sm">{t("settings.edit")}</Button>
                </div>
                <ul className="divide-y divide-border">
                  {section.fields.map((f) => (
                    <li key={f.label} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-muted-foreground">{f.label}</span>
                      <span className="text-sm font-medium text-foreground">{f.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {section.id === "account" && <OpenclawAgentMappingSection />}
            </Fragment>
          );
        })}

        {/* System Config — password protected */}
        <SystemConfigSection />
      </div>
    </AdminLayout>
  );
}
