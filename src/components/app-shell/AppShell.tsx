"use client";

import Link from "next/link";
import {
  Dumbbell,
  Gift,
  HeartPulse,
  History,
  LayoutDashboard,
  Medal,
  RotateCcw,
  Trophy,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { levelFromXp, xpForNextLevel } from "@/features/economy/xp-rules";

type AppView = "dashboard" | "workout" | "history" | "rewards" | "life" | "profile";

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
  username,
  onReset,
  resetLabel = "Reset demo data",
  children,
}: {
  activeView: AppView;
  coins: number;
  xp: number;
  streak: number;
  username: string;
  onReset: () => void;
  resetLabel?: string;
  children: ReactNode;
}) {
  const level = levelFromXp(xp);
  const nextLevelXp = xpForNextLevel(level);
  const previousLevelXp = level <= 1 ? 0 : xpForNextLevel(level - 1);
  const levelProgress = Math.min(
    100,
    Math.round(((xp - previousLevelXp) / (nextLevelXp - previousLevelXp)) * 100),
  );

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Trophy size={21} aria-hidden />
          </div>
          <div>
            <p className="brand-name">Gymition</p>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={item.view === activeView ? "nav-link active" : "nav-link"}
                href={item.href}
                key={item.href}
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

        <button className="ghost-action" type="button" onClick={onReset}>
          <RotateCcw size={16} aria-hidden />
          {resetLabel}
        </button>
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
            <span>{streak} day streak</span>
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
