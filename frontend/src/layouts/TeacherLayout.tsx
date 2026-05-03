import { ReactNode, useState } from "react";
import { Dropdown, Badge } from "antd";
import {
  DashboardOutlined, FileTextOutlined, TeamOutlined,
  InboxOutlined, TrophyOutlined, PictureOutlined,
  EnvironmentOutlined, LogoutOutlined, UserOutlined,
  RightOutlined, AppstoreOutlined,
} from "@ant-design/icons";
import { Link, useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { useIsMobile } from "../lib/hooks";

const NAV = [
  { key: "/",                   icon: DashboardOutlined,   label: "Главная",    mobileLabel: "Главная"   },
  { key: "/tasks",              icon: FileTextOutlined,    label: "Задания",       mobileLabel: "Задания"      },
  { key: "/students",           icon: TeamOutlined,        label: "Ученики",   mobileLabel: "Ученики"  },
  { key: "/submissions",        icon: InboxOutlined,       label: "Ответы",     mobileLabel: "Ответы"    },
  { key: "/rankings",           icon: TrophyOutlined,      label: "Рейтинг",      mobileLabel: "Рейтинг"     },
  { key: "/library/characters", icon: PictureOutlined,     label: "Персонажи",  mobileLabel: "Персонажи" },
  { key: "/library/locations",  icon: EnvironmentOutlined, label: "Локации", mobileLabel: "Локации"  },
];

// First 4 in bottom nav, rest in "More" drawer
const BOTTOM_NAV  = NAV.slice(0, 4);
const DRAWER_NAV  = NAV.slice(4);

// ── Mobile "More" drawer ─────────────────────────────────────────────────────
function DrawerMenu({ open, onClose, active, user, logout }: {
  open: boolean; onClose: () => void; active: string; user: any; logout: () => void;
}) {
  const [, navigate] = useLocation();
  const initials = user?.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  const handleNav = (key: string) => {
    onClose();
    // Small delay so drawer closes smoothly before navigation
    setTimeout(() => navigate(key), 10);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 90 }}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 95,
              background: "#fff", borderRadius: "20px 20px 0 0",
              padding: "20px 20px calc(24px + env(safe-area-inset-bottom,0px))",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e5e7eb", margin: "0 auto 20px" }} />

            {/* Extra nav items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {DRAWER_NAV.map(({ key, icon: Icon, label }) => {
                const on = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleNav(key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "13px 16px", borderRadius: 12,
                      background: on ? "#eef2ff" : "transparent",
                      color: on ? "#3b5bdb" : "#374151",
                      border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                    }}
                  >
                    <Icon style={{ fontSize: 20, color: on ? "#3b5bdb" : "#6b7280" }} />
                    <span style={{ fontSize: 15, fontWeight: on ? 600 : 400 }}>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "#f3f4f6", margin: "16px 0" }} />

            {/* User row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 4px" }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,#3b5bdb,#1c3fb5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 15, fontWeight: 700 }}>
                {user?.avatar ? <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{user?.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Учитель</div>
              </div>
              <button
                onClick={() => { logout(); onClose(); }}
                style={{ background: "#fef2f2", border: "none", borderRadius: 10, padding: "8px 14px", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Выйти
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Mobile top header ─────────────────────────────────────────────────────────
function MobileHeader({ title, user }: { title: string; user: any }) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "#fff", borderBottom: "1px solid #f0f0f0",
      boxShadow: "0 1px 8px rgba(15,23,42,0.06)",
      display: "flex", alignItems: "center",
      padding: "0 16px", height: 52, gap: 10,
    }}>
      <span style={{ fontSize: 20 }}>🔍</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
      </div>
    </header>
  );
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────────
function MobileBottomNav({ active, onMoreClick }: {
  active: string; onMoreClick: () => void;
}) {
  const isMore = DRAWER_NAV.some(n => active === n.key || (n.key !== "/" && active.startsWith(n.key)));
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80,
      background: "#fff", borderTop: "1px solid #f0f0f0",
      boxShadow: "0 -4px 20px rgba(15,23,42,0.08)",
      display: "flex", alignItems: "stretch",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {BOTTOM_NAV.map(({ key, icon: Icon, mobileLabel }) => {
        const on = active === key || (key !== "/" && active.startsWith(key));
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
                {mobileLabel}
              </span>
            </div>
          </Link>
        );
      })}
      {/* More button */}
      <button
        onClick={onMoreClick}
        style={{
          flex: 1, background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "10px 4px 8px", gap: 3,
          color: isMore ? "#3b5bdb" : "#9ca3af",
          borderTop: isMore ? "2.5px solid #3b5bdb" : "2.5px solid transparent",
        }}
      >
        <AppstoreOutlined style={{ fontSize: 20 }} />
        <span style={{ fontSize: 10, fontWeight: isMore ? 700 : 500, letterSpacing: 0.3 }}>Ещё</span>
      </button>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const active = NAV
    .filter(n => location === n.key || (n.key !== "/" && location.startsWith(n.key)))
    .sort((a, b) => b.key.length - a.key.length)[0]?.key || "/";

  const title = NAV.find(n => n.key === active)?.label || "Главная";
  const initials = user?.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column" }}>
        <MobileHeader title={title} user={user} />
        <main style={{
          flex: 1, padding: "16px 14px",
          paddingBottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
        }}>
          {children}
        </main>
        <MobileBottomNav active={active} onMoreClick={() => setDrawerOpen(true)} />
        <DrawerMenu
          open={drawerOpen} onClose={() => setDrawerOpen(false)}
          active={active} user={user} logout={logout}
        />
      </div>
    );
  }

  // ── DESKTOP (unchanged) ───────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb" }}>
      <aside style={{ width: 220, flexShrink: 0, background: "#fff", borderRight: "1px solid #f0f0f0", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflow: "auto" }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔍</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: -0.3 }}>Детектив</span>
        </div>
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#c0c0c0", textTransform: "uppercase", letterSpacing: 1, padding: "0 10px 8px" }}>Меню</div>
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
            menu={{ items: [{ key: "logout", label: "Выйти", icon: <LogoutOutlined />, onClick: logout, danger: true }] }}
            placement="topRight"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", transition: "background 0.13s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f7f7f7"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg,#3b5bdb,#1c3fb5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 700 }}>
                {user?.avatar ? <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: "#bbb" }}>Учитель</div>
              </div>
            </div>
          </Dropdown>
        </div>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 52, background: "#fff", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", padding: "0 28px", gap: 10, position: "sticky", top: 0, zIndex: 40 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: "#3b5bdb" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{title}</span>
        </header>
        <main style={{ flex: 1, padding: "24px 28px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}