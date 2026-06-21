"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import {
  Dumbbell,
  Gift,
  Flame,
  HeartPulse,
  History,
  LayoutDashboard,
  LogOut,
  Medal,
  Menu,
  RotateCcw,
  Trophy,
  User,
  X,
} from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";
import { levelFromXp, xpForNextLevel } from "@/features/economy/xp-rules";

export type AppView = "dashboard" | "workout" | "history" | "rewards" | "life" | "profile";

const navItems = [
  { view: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "workout", href: "/workout", label: "Workout", icon: Dumbbell },
  { view: "history", href: "/history", label: "History", icon: History },
  { view: "rewards", href: "/rewards", label: "Rewards", icon: Gift },
  { view: "life", href: "/life", label: "Life", icon: HeartPulse },
  { view: "profile", href: "/profile", label: "Profile", icon: User },
] satisfies Array<{
  view: AppView;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}>;

export function AppShell({
  activeView,
  coins,
  xp,
  streak,
  checkedInToday,
  username,
  onReset,
  onNavigate,
  resetLabel = "Reset demo data",
  children,
}: {
  activeView: AppView;
  coins: number;
  xp: number;
  streak: number;
  checkedInToday: boolean;
  username: string;
  onReset: () => void;
  onNavigate?: (view: AppView, href: string) => void;
  resetLabel?: string;
  children: ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const level = levelFromXp(xp);
  const nextLevelXp = xpForNextLevel(level);
  const previousLevelXp = level <= 1 ? 0 : xpForNextLevel(level - 1);
  const levelProgress = Math.min(
    100,
    Math.round(((xp - previousLevelXp) / (nextLevelXp - previousLevelXp)) * 100),
  );

  return (
    <div className="app-frame">
      <aside className={isMobileMenuOpen ? "sidebar menu-open" : "sidebar"}>
        <div className="sidebar-mobile-head">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Trophy size={21} aria-hidden />
            </div>
            <div>
              <p className="brand-name">Gymition</p>
            </div>
          </div>

          <button
            className="mobile-menu-toggle"
            type="button"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
          >
            {isMobileMenuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>

        <div className="sidebar-content">
          <nav className="primary-nav" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              function handleNavigation(event: MouseEvent<HTMLAnchorElement>) {
                setIsMobileMenuOpen(false);

                if (!onNavigate) {
                  return;
                }
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                  return;
                }

                event.preventDefault();
                onNavigate(item.view, item.href);
              }

              return (
                <Link
                  className={item.view === activeView ? "nav-link active" : "nav-link"}
                  href={item.href}
                  key={item.href}
                  onClick={handleNavigation}
                >
                  <Icon size={18} aria-hidden />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-card">
            <div className="sidebar-card-top">
              <Medal size={18} aria-hidden />
              <span>Level {level}</span>
            </div>
            <div className="meter" aria-label={`Level progress ${levelProgress}%`}>
              <span style={{ width: `${levelProgress}%` }} />
            </div>
            <p>{xp} XP earned</p>
          </div>

          <button
            className="ghost-action"
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              onReset();
            }}
          >
            <RotateCcw size={16} aria-hidden />
            {resetLabel}
          </button>

          <div className="sidebar-logout">
            <SignOutButton redirectUrl="/sign-in">
              <button className="ghost-action" type="button">
                <LogOut size={16} aria-hidden />
                Log out
              </button>
            </SignOutButton>
          </div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Gymition</p>
            <h1>{activeViewLabel(activeView)}</h1>
          </div>
          <div className="topbar-stats" aria-label="Current player status">
            <span>{username}</span>
            <strong>{coins} coins</strong>
            <span className="topbar-checkin-streak" title={`${streak} day check-in streak`}>
              <Flame
                className={checkedInToday ? "topbar-checkin-flame checked" : "topbar-checkin-flame"}
                size={18}
                aria-hidden
              />
              <span>{streak} days</span>
            </span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function activeViewLabel(view: AppView) {
  if (view === "dashboard") return "Dashboard";
  if (view === "workout") return "Workout Log";
  if (view === "history") return "History";
  if (view === "rewards") return "Reward Shop";
  if (view === "life") return "Life Tracker";
  return "Profile";
}
