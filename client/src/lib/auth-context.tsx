import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthUser {
  id: string;
  email: string;
  selectedPlan: string | null;
  currentRestaurantId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  selectPlan: (planId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ user: AuthUser }>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const user = data?.user ?? null;

  // Seed the new user's auth state FIRST, then drop every OTHER cached query
  // (restaurants, agents, chat history, etc.) so the next user doesn't see
  // the previous user's data. We must NOT call queryClient.clear() here:
  // clearing the auth query mid-flow causes the active /api/auth/me observer
  // to refetch and race with the setQueryData call, which can briefly leave
  // user === null. Pages like /admin/agents/:id watch user in a useEffect and
  // bounce to /login the moment they see null — so the user lands on login
  // right after a successful login until they refresh.
  const swapUser = (user: AuthUser) => {
    queryClient.setQueryData(["/api/auth/me"], { user });
    queryClient.removeQueries({
      predicate: (q) => q.queryKey[0] !== "/api/auth/me",
    });
  };

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Login failed");
    swapUser(json.user);
    return json.user;
  };

  const register = async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiRequest("POST", "/api/auth/register", { email, password });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Registration failed");
    swapUser(json.user);
    return json.user;
  };

  const logout = async (): Promise<void> => {
    await apiRequest("POST", "/api/auth/logout", {});
    // Drop EVERY cached query, not just /api/auth/me — otherwise the next
    // user (or the login page) sees stale restaurant/agent/chat data.
    queryClient.clear();
  };

  const selectPlan = async (planId: string): Promise<void> => {
    const res = await apiRequest("POST", "/api/auth/select-plan", { planId });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to select plan");
    queryClient.setQueryData(["/api/auth/me"], { user: json.user });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, selectPlan }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
