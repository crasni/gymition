"use client";

import Link from "next/link";
import {
  Dumbbell,
  Gift,
  History,
  LayoutDashboard,
  Medal,
  RotateCcw,
  Trophy,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { levelFromXp, xpForNextLevel } from "@/features/economy/xp-rules";

type AppView = "dashboard" | "workout" | "history" | "rewards" | "profile";

const navItems = [
  { view: "dashboard", href: "/dashboard", label: "總覽", icon: LayoutDashboard },
  { view: "workout", href: "/workout", label: "訓練", icon: Dumbbell },
  { view: "history", href: "/history", label: "紀錄", icon: History },
  { view: "rewards", href: "/rewards", label: "獎勵", icon: Gift },
  { view: "profile", href: "/profile", label: "個人", icon: User },
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
  children,
}: {
  activeView: AppView;
  coins: number;
  xp: number;
  streak: number;
  username: string;
  onReset: () => void;
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
            <p className="brand-caption">Phase 0 本地版</p>
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
            <span>等級 {level}</span>
          </div>
          <div className="meter" aria-label={`等級進度 ${levelProgress}%`}>
            <span style={{ width: `${levelProgress}%` }} />
          </div>
          <p>累積 {xp} XP</p>
        </div>

        <button className="ghost-action" type="button" onClick={onReset}>
          <RotateCcw size={16} aria-hidden />
          重置資料
        </button>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">個人健身獎勵系統</p>
            <h1>{activeViewLabel(activeView)}</h1>
          </div>
          <div className="topbar-stats" aria-label="目前個人狀態">
            <span>{username}</span>
            <strong>{coins} 金幣</strong>
            <span>連續 {streak} 天</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function activeViewLabel(view: AppView) {
  if (view === "dashboard") return "總覽";
  if (view === "workout") return "訓練紀錄";
  if (view === "history") return "歷史紀錄";
  if (view === "rewards") return "獎勵商店";
  return "個人檔案";
}
