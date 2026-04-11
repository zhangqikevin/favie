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

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Login failed");
    queryClient.setQueryData(["/api/auth/me"], { user: json.user });
    return json.user;
  };

  const register = async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiRequest("POST", "/api/auth/register", { email, password });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Registration failed");
    queryClient.setQueryData(["/api/auth/me"], { user: json.user });
    return json.user;
  };

  const logout = async (): Promise<void> => {
    await apiRequest("POST", "/api/auth/logout", {});
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
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
