import { create } from "zustand";
import api from "./api";

export type User = {
  id: number;
  name: string;
  phone: string;
  role: "teacher" | "student";
  avatar?: string;
  xp: number;
  level: number;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (phone: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  init: async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const { data } = await api.get<User>("/auth/me");
      set({ user: data, loading: false });
    } catch {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      set({ user: null, loading: false });
    }
  },
  login: async (phone, password) => {
    const { data } = await api.post<{ token: string; user: User }>("/auth/login", { phone, password });
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    set({ user: data.user });
    return data.user;
  },
  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    set({ user: null });
    location.href = "/login";
  },
  refreshUser: async () => {
    try {
      const { data } = await api.get<User>("/auth/me");
      localStorage.setItem("auth_user", JSON.stringify(data));
      set({ user: data });
    } catch {
    }
  },
}));