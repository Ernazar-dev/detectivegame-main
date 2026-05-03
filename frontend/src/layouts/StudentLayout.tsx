import { ReactNode, useState } from "react";
import { Dropdown } from "antd";
import {
  HomeOutlined, FileSearchOutlined, InboxOutlined,
  TrophyOutlined, UserOutlined, LogoutOutlined, RightOutlined,
  MenuOutlined, CloseOutlined,
} from "@ant-design/icons";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { useIsMobile } from "../lib/hooks";

const NAV = [
  { key: "/",            icon: HomeOutlined,       label: "Главная"    },
  { key: "/tasks",       icon: FileSearchOutlined, label: "Задания"    },
  { key: "/submissions", icon: InboxOutlined,      label: "Ответы"     },
  { key: "/rankings",    icon: TrophyOutlined,     label: "Рейтинг"    },
  { key: "/profile",     icon: UserOutlined,       label: "Профиль"    },
];

// ── Shared avatar component ──────────────────────────────────────────────────
function UserAvatar({ user, size = 32, gradient = "linear-gradient(135deg,#748ffc,#3b5bdb)" }: {
  user: any; size?: number; gradient?: string;
}) {
  const initials = user?.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      background: gradient, display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontSize: size * 0.375, fontWeight: 700,
    }}>
      {user?.avatar
        ? <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        : initials}
    </div>
  );
}

// ── Mobile bottom navigation ─────────────────────────────────────────────────
function MobileBottomNav({ active, user, logout }: {
  active: string; user: any; logout: () => void;
}) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "#fff",
      borderTop: "1px solid #f0f0f0",
      boxShadow: "0 -4px 20px rgba(15,23,42,0.08)",
      display: "flex", alignItems: "stretch",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {NAV.map(({ key, icon: Icon, label }) => {
        const on = active === key;
        return (
          <Link key={key} href={key} style={{ flex: 1, textDecoration: "none" }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "10px 4px 8px", gap: 3,
              color: on ? "#3b5bdb" : "#9ca3af",
              borderTop: on ? "2.5px solid #3b5bdb" : "2.5px solid transparent",
              transition: "all 0.15s",
            }}>
              <Icon style={{ fontSize: 20 }} />
              <span style={{ fontSize: 10, fontWeight: on ? 700 : 500, letterSpacing: 0.3 }}>
                {label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Mobile top header ────────────────────────────────────────────────────────
function MobileHeader({ title, user, logout }: {
  title: string; user: any; logout: () => void;
}) {
  const xpPct = (user?.xp ?? 0) % 100;
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "#fff", borderBottom: "1px solid #f0f0f0",
      boxShadow: "0 1px 8px rgba(15,23,42,0.06)",
    }}>
      {/* Main bar */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "0 16px", height: 52, gap: 12,
      }}>
        {/* Logo */}
        <span style={{ fontSize: 20 }}>🕵️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: -0.3 }}>
            {title}
          </div>
        </div>
        {/* User avatar with dropdown */}
        <Dropdown
          menu={{ items: [
            { key: "profile", label: <Link href="/profile">Профиль</Link>, icon: <UserOutlined /> },
            { type: "divider" as const },
            { key: "logout", label: "Выйти", icon: <LogoutOutlined />, onClick: logout, danger: true },
          ]}}
          placement="bottomRight"
          trigger={["click"]}
        >
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <UserAvatar user={user} size={34} />
          </button>
        </Dropdown>
      </div>

      {/* XP mini-bar */}
      <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: "#888", flexShrink: 0 }}>
          Ур.{user?.level ?? 1}
        </span>
        <div style={{ flex: 1, height: 4, background: "#e0e7ff", borderRadius: 99, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${xpPct}%`, borderRadius: 99,
            background: "linear-gradient(90deg,#748ffc,#3b5bdb)",
            transition: "width 0.6s ease",
          }} />
        </div>
        <span style={{ fontSize: 11, color: "#888", flexShrink: 0 }}>
          {user?.xp ?? 0} XP
        </span>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
export default function StudentLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  const active = NAV
    .filter(n => location === n.key || (n.key !== "/" && location.startsWith(n.key)))
    .sort((a, b) => b.key.length - a.key.length)[0]?.key || "/";

  const xpPct    = (user?.xp ?? 0) % 100;
  const xpToNext = 100 - xpPct;
  const title    = NAV.find(n => n.key === active)?.label || "Главная";

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column" }}>
        <MobileHeader title={title} user={user} logout={logout} />
        <main style={{
          flex: 1,
          padding: "16px 14px",
          paddingBottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
        }}>
          {children}
        </main>
        <MobileBottomNav active={active} user={user} logout={logout} />
      </div>
    );
  }

  // ── DESKTOP (unchanged) ───────────────────────────────────────────────────
  const initials = user?.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb" }}>
      <aside style={{
        width: 220, flexShrink: 0, background: "#fff",
        borderRight: "1px solid #f0f0f0",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh", overflow: "auto",
      }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🕵️</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: -0.3 }}>Детектив</span>
        </div>
        <div style={{ padding: "12px 14px 4px" }}>
          <div style={{ background: "#f5f8ff", borderRadius: 10, padding: "10px 12px", border: "1px solid #e8eeff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 6 }}>
              <span>Уровень {user?.level ?? 1}</span>
              <span>{user?.xp ?? 0} XP</span>
            </div>
            <div style={{ height: 5, background: "#e0e7ff", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${xpPct}%`, borderRadius: 99, background: "linear-gradient(90deg,#748ffc,#3b5bdb)", transition: "width 0.6s ease" }} />
            </div>
            <div style={{ fontSize: 10, color: "#b0b8d8", marginTop: 5 }}>До следующего уровня {xpToNext} XP</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "8px 10px" }}>
          {NAV.map(({ key, icon: Icon, label }) => {
            const on = active === key;
            return (
              <Link key={key} href={key}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, marginBottom: 2, background: on ? "#eef2ff" : "transparent", color: on ? "#3b5bdb" : "#555", fontWeight: on ? 600 : 400, fontSize: 13.5, cursor: "pointer", transition: "all 0.13s" }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = "#f7f7f7"; }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
                >
                  <Icon style={{ fontSize: 15 }} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {on && <RightOutlined style={{ fontSize: 10, opacity: 0.45 }} />}
                </div>
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: "12px 10px", borderTop: "1px solid #f5f5f5" }}>
          <Dropdown
            menu={{ items: [
              { key: "profile", label: <Link href="/profile">Профиль</Link>, icon: <UserOutlined /> },
              { type: "divider" as const },
              { key: "logout", label: "Выйти", icon: <LogoutOutlined />, onClick: logout, danger: true },
            ]}}
            placement="topRight"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", transition: "background 0.13s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f7f7f7"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg,#748ffc,#3b5bdb)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 700 }}>
                {user?.avatar ? <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: "#bbb" }}>Ученик</div>
              </div>
            </div>
          </Dropdown>
        </div>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 52, background: "#fff", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", padding: "0 28px", gap: 10, position: "sticky", top: 0, zIndex: 40 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: "#748ffc" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{title}</span>
        </header>
        <main style={{ flex: 1, padding: "24px 28px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
