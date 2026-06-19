"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Dumbbell,
  Flame,
  Gift,
  Pencil,
  Plus,
  Save,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell/AppShell";
import {
  calculateStreakBonus,
  createLedgerEntry,
  REWARD_RULES,
} from "@/features/economy/reward-rules";
import { levelFromXp } from "@/features/economy/xp-rules";
import type {
  Exercise,
  GymitionState,
  LedgerEntry,
  LedgerReason,
  Reward,
  WorkoutEntry,
  WorkoutSession,
} from "@/features/economy/types";
import { seedExercises } from "@/features/exercises/seed-exercises";
import { calculateQuestProgress, getDailyQuestKey } from "@/features/quests/quest-engine";
import { dailyQuests } from "@/features/quests/quest-rules";
import { seedRewards } from "@/features/rewards/reward-service";
import { nextLoginStreak } from "@/features/streaks/streak-service";
import { formatShortDate, localDateKey } from "@/lib/dates";
import { createId } from "@/lib/ids";

type AppView = "dashboard" | "workout" | "history" | "rewards" | "profile";

type DraftEntry = {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number;
  durationMinutes: number;
  distanceMeters: number;
  notes: string;
};

const STORAGE_KEY = "gymition.phase0.state";

const defaultDraftEntry: DraftEntry = {
  exerciseId: seedExercises[0].id,
  sets: 3,
  reps: 10,
  weight: 40,
  durationMinutes: 10,
  distanceMeters: 0,
  notes: "",
};

const motivationalQuotes = [
  {
    line: "先完成今天的一組，其他的交給節奏。",
    note: "把第一個動作記下來，訓練就已經開始了。",
  },
  {
    line: "不用每次都很猛，但要讓自己有紀錄。",
    note: "穩定累積的重量、次數和時間，會比感覺更誠實。",
  },
  {
    line: "今天的你，只需要贏過沒有開始的版本。",
    note: "小一點也沒關係，先把訓練清單填起來。",
  },
  {
    line: "身體會記得你重複做過的事。",
    note: "完成訓練後，金幣、XP 和任務會自動結算。",
  },
  {
    line: "把動作做乾淨，比把版面填滿更重要。",
    note: "一次記一個動作，讓今天的訓練清楚可追蹤。",
  },
] as const;

export function GymitionPrototype({ initialView }: { initialView: AppView }) {
  const [state, setState] = useState(createInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [draftEntry, setDraftEntry] = useState(defaultDraftEntry);
  const [draftEntries, setDraftEntries] = useState<WorkoutEntry[]>([]);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  useEffect(() => {
    window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setState(JSON.parse(stored) as GymitionState);
      }
      setHydrated(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [hydrated, state]);

  const questProgress = useMemo(
    () => calculateQuestProgress(state, dailyQuests, seedExercises),
    [state],
  );
  const recentLedger = [...state.coinLedger, ...state.xpLedger]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const level = levelFromXp(state.user.xp);
  const ownedRewardIds = new Set(state.userRewards.map((reward) => reward.rewardId));
  const equippedReward = seedRewards.find((reward) =>
    state.userRewards.some((userReward) => userReward.rewardId === reward.id && userReward.equippedAt),
  );

  function claimDailyReward() {
    const today = localDateKey();
    if (state.user.lastLoginRewardDate === today) {
      return;
    }

    setState((current) => {
      const nextStreak = nextLoginStreak(current.user.lastLoginRewardDate, current.user.currentStreak);
      const streakBonus = calculateStreakBonus(nextStreak);
      const coinLedger: LedgerEntry[] = [
        createLedgerEntry(REWARD_RULES.dailyLogin.coins, "daily_login", "login", today),
        createLedgerEntry(streakBonus, "streak_bonus", "login", today),
      ];
      const xpLedger: LedgerEntry[] = [
        createLedgerEntry(REWARD_RULES.dailyLogin.xp, "daily_login", "login", today),
      ];

      return {
        ...current,
        user: {
          ...current.user,
          coins: current.user.coins + REWARD_RULES.dailyLogin.coins + streakBonus,
          xp: current.user.xp + REWARD_RULES.dailyLogin.xp,
          currentStreak: nextStreak,
          lastLoginRewardDate: today,
        },
        coinLedger: [...current.coinLedger, ...coinLedger],
        xpLedger: [...current.xpLedger, ...xpLedger],
      };
    });
  }

  function addDraftEntry() {
    const exercise = seedExercises.find((item) => item.id === draftEntry.exerciseId);
    if (!exercise) {
      return;
    }

    const entry: WorkoutEntry = {
      id: createId("entry"),
      exerciseId: exercise.id,
      sets: usesSets(exercise) ? draftEntry.sets : undefined,
      reps: usesReps(exercise) ? draftEntry.reps : undefined,
      weight: exercise.measurementType === "reps_weight" ? draftEntry.weight : undefined,
      durationSeconds: exercise.measurementType === "duration" ? draftEntry.durationMinutes * 60 : undefined,
      distanceMeters: exercise.measurementType === "distance" ? draftEntry.distanceMeters : undefined,
      notes: draftEntry.notes.trim() || undefined,
      coinsEarned: REWARD_RULES.exerciseLogged.coins,
      xpEarned: REWARD_RULES.exerciseLogged.xp,
    };

    setDraftEntries((entries) => [...entries, entry]);
    setDraftEntry((current) => ({ ...current, notes: "" }));
  }

  function completeWorkout() {
    if (draftEntries.length === 0) {
      return;
    }

    setState((current) => {
      const now = new Date().toISOString();
      const workoutId = createId("workout");
      const exerciseCoins = draftEntries.reduce((total, entry) => total + entry.coinsEarned, 0);
      const exerciseXp = draftEntries.reduce((total, entry) => total + entry.xpEarned, 0);
      const workoutCoins = exerciseCoins + REWARD_RULES.workoutCompleted.coins;
      const workoutXp = exerciseXp + REWARD_RULES.workoutCompleted.xp;
      const workout: WorkoutSession = {
        id: workoutId,
        status: "completed",
        startedAt: now,
        completedAt: now,
        entries: draftEntries,
        totalCoinsEarned: workoutCoins,
        totalXpEarned: workoutXp,
      };
      const entryCoinLedger = draftEntries.map((entry) =>
        createLedgerEntry(entry.coinsEarned, "exercise_logged", "workout_entry", entry.id),
      );
      const entryXpLedger = draftEntries.map((entry) =>
        createLedgerEntry(entry.xpEarned, "exercise_logged", "workout_entry", entry.id),
      );

      const rewardedWorkoutState: GymitionState = {
        ...current,
        user: {
          ...current.user,
          coins: current.user.coins + workoutCoins,
          xp: current.user.xp + workoutXp,
        },
        workouts: [...current.workouts, workout],
        coinLedger: [
          ...current.coinLedger,
          ...entryCoinLedger,
          createLedgerEntry(REWARD_RULES.workoutCompleted.coins, "workout_completed", "workout", workoutId),
        ],
        xpLedger: [
          ...current.xpLedger,
          ...entryXpLedger,
          createLedgerEntry(REWARD_RULES.workoutCompleted.xp, "workout_completed", "workout", workoutId),
        ],
      };

      return applyAutoQuestRewards(rewardedWorkoutState);
    });

    const coinTotal =
      draftEntries.reduce((total, entry) => total + entry.coinsEarned, 0) +
      REWARD_RULES.workoutCompleted.coins;
    const xpTotal =
      draftEntries.reduce((total, entry) => total + entry.xpEarned, 0) +
      REWARD_RULES.workoutCompleted.xp;
    setLastSummary(`訓練完成：任務獎勵前獲得 +${coinTotal} 金幣、+${xpTotal} XP。`);
    setDraftEntries([]);
  }

  function purchaseReward(reward: Reward) {
    if (state.user.coins < reward.cost || ownedRewardIds.has(reward.id)) {
      return;
    }

    setState((current) => ({
      ...current,
      user: {
        ...current.user,
        coins: current.user.coins - reward.cost,
      },
      userRewards: [
        ...current.userRewards,
        {
          rewardId: reward.id,
          purchasedAt: new Date().toISOString(),
          equippedAt: reward.type === "title" ? new Date().toISOString() : null,
        },
      ],
      coinLedger: [
        ...current.coinLedger,
        createLedgerEntry(-reward.cost, "reward_purchase", "reward", reward.id),
      ],
    }));
  }

  function resetDemo() {
    const freshState = createInitialState();
    setState(freshState);
    setDraftEntries([]);
    setLastSummary(null);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState));
  }

  function saveProfile(username: string) {
    setState((current) => ({
      ...current,
      user: {
        ...current.user,
        username,
      },
    }));
  }

  return (
    <AppShell
      activeView={initialView}
      coins={state.user.coins}
      xp={state.user.xp}
      streak={state.user.currentStreak}
      username={state.user.username}
      onReset={resetDemo}
    >
      {initialView === "dashboard" && (
        <DashboardView
          state={state}
          level={level}
          questProgress={questProgress}
          recentLedger={recentLedger}
          onClaimDailyReward={claimDailyReward}
          dailyClaimed={state.user.lastLoginRewardDate === localDateKey()}
        />
      )}

      {initialView === "workout" && (
        <WorkoutView
          draftEntry={draftEntry}
          draftEntries={draftEntries}
          exercises={seedExercises}
          lastSummary={lastSummary}
          setDraftEntry={setDraftEntry}
          onAddEntry={addDraftEntry}
          onRemoveEntry={(entryId) =>
            setDraftEntries((entries) => entries.filter((entry) => entry.id !== entryId))
          }
          onCompleteWorkout={completeWorkout}
        />
      )}

      {initialView === "history" && <HistoryView workouts={state.workouts} exercises={seedExercises} />}

      {initialView === "rewards" && (
        <RewardsView
          rewards={seedRewards}
          coins={state.user.coins}
          ownedRewardIds={ownedRewardIds}
          onPurchaseReward={purchaseReward}
        />
      )}

      {initialView === "profile" && (
        <ProfileView
          state={state}
          level={level}
          equippedReward={equippedReward}
          ownedRewardIds={ownedRewardIds}
          onSaveProfile={saveProfile}
        />
      )}
    </AppShell>
  );
}

function DashboardView({
  state,
  level,
  questProgress,
  recentLedger,
  onClaimDailyReward,
  dailyClaimed,
}: {
  state: GymitionState;
  level: number;
  questProgress: ReturnType<typeof calculateQuestProgress>;
  recentLedger: LedgerEntry[];
  onClaimDailyReward: () => void;
  dailyClaimed: boolean;
}) {
  const completedQuestCount = questProgress.filter((item) => item.completed).length;
  const totalQuestCount = dailyQuests.length;
  const quote = motivationalQuotes[getDailyQuoteIndex(localDateKey())];

  return (
    <div className="home-layout">
      <section className="hero-command">
        <div className="hero-copy">
          <span className="today-line">今日訓練提醒</span>
          <h2>{quote.line}</h2>
          <p>{quote.note}</p>
        </div>
        <div className="hero-actions">
          <a className="start-workout-action" href="/workout">
            <Dumbbell size={20} aria-hidden />
            開始訓練
            <ArrowRight size={18} aria-hidden />
          </a>
          <button className="daily-reward-row" type="button" onClick={onClaimDailyReward} disabled={dailyClaimed}>
            <Gift size={20} aria-hidden />
            <span>
              <strong>{dailyClaimed ? "每日獎勵已領取" : "領取每日獎勵"}</strong>
              <small>
                {dailyClaimed
                  ? "明天再回來延續連續天數"
                  : `+${REWARD_RULES.dailyLogin.coins} 金幣、+${REWARD_RULES.dailyLogin.xp} XP`}
              </small>
            </span>
          </button>
        </div>
      </section>

      <section className="status-strip" aria-label="目前進度">
        <StatTile label="金幣" value={state.user.coins.toString()} icon={<CircleDollarSign size={19} />} />
        <StatTile label="等級" value={`${level}`} icon={<Sparkles size={19} />} />
        <StatTile label="連續" value={`${state.user.currentStreak} 天`} icon={<Flame size={19} />} />
      </section>

      <div className="workbench-grid">
        <div className="workbench-main">
          <section className="activity-panel">
            <div className="section-heading">
              <div>
                <p className="section-label">最近活動</p>
                <h2>最近獎勵</h2>
              </div>
            </div>
            <div className="ledger-list">
              {recentLedger.length === 0 ? (
                <p className="empty-copy">尚無紀錄。</p>
              ) : (
                recentLedger.slice(0, 3).map((entry) => (
                  <div className="ledger-row" key={entry.id}>
                    <span>{ledgerReasonLabel(entry.reason)}</span>
                    <strong>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="today-rail">
          <section className="today-panel">
            <div className="rail-heading">
              <div>
                <p className="section-label">今日任務</p>
                <h2>{completedQuestCount}/{totalQuestCount} 已完成</h2>
              </div>
              <CalendarDays size={18} aria-hidden />
            </div>
            <div className="quest-list">
              {dailyQuests.map((quest) => {
                const progress = questProgress.find((item) => item.questId === quest.id);
                const value = Math.min(progress?.progress ?? 0, quest.targetValue);
                const percent = Math.round((value / quest.targetValue) * 100);
                return (
                  <div className={progress?.completed ? "quest-row done" : "quest-row"} key={quest.id}>
                    <div className="quest-check">{progress?.completed ? <Check size={15} aria-hidden /> : null}</div>
                    <div>
                      <strong>{quest.name}</strong>
                    </div>
                    <div className="quest-progress">
                      <span>
                        {value}/{quest.targetValue}
                      </span>
                      <div className="meter compact">
                        <span style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function WorkoutView({
  draftEntry,
  draftEntries,
  exercises,
  lastSummary,
  setDraftEntry,
  onAddEntry,
  onRemoveEntry,
  onCompleteWorkout,
}: {
  draftEntry: DraftEntry;
  draftEntries: WorkoutEntry[];
  exercises: Exercise[];
  lastSummary: string | null;
  setDraftEntry: React.Dispatch<React.SetStateAction<DraftEntry>>;
  onAddEntry: () => void;
  onRemoveEntry: (entryId: string) => void;
  onCompleteWorkout: () => void;
}) {
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const selectedExercise = exercises.find((exercise) => exercise.id === draftEntry.exerciseId) ?? exercises[0];

  function submitEntry() {
    onAddEntry();
    setIsAddExerciseOpen(false);
  }

  return (
    <div className="workout-layout">
      <section className="workout-toolbar">
        <div>
          <p className="section-label">目前訓練</p>
          <h2>{draftEntries.length === 0 ? "準備開始紀錄" : `已加入 ${draftEntries.length} 個動作`}</h2>
        </div>
        <button className="round-add-action" type="button" onClick={() => setIsAddExerciseOpen(true)}>
          <Plus size={20} aria-hidden />
          新增動作
        </button>
      </section>

      <section className="workout-list-surface">
        <div className="workout-list-head">
          <span>動作</span>
          <span>內容</span>
          <span>獎勵</span>
          <span aria-hidden />
        </div>
        <div className="entry-list workout-entry-list">
          {draftEntries.length === 0 ? (
            <button className="empty-workout-row" type="button" onClick={() => setIsAddExerciseOpen(true)}>
              <Plus size={20} aria-hidden />
              <strong>加入第一個動作</strong>
            </button>
          ) : (
            draftEntries.map((entry) => {
              const exercise = exercises.find((item) => item.id === entry.exerciseId);
              return (
                <div className="workout-entry-row" key={entry.id}>
                  <div className="workout-entry-main">
                    {exercise && <span className="item-type-badge">{categoryLabel(exercise.category)}</span>}
                    <strong>{exercise?.name}</strong>
                  </div>
                  <span>{formatEntry(entry)}</span>
                  <span>+{entry.coinsEarned} 金幣 / +{entry.xpEarned} XP</span>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`移除 ${exercise?.name}`}
                    onClick={() => onRemoveEntry(entry.id)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              );
            })
          )}
        </div>
        {lastSummary && <p className="success-copy">{lastSummary}</p>}
      </section>

      <div className="workout-footer">
        <span>{draftEntries.length === 0 ? "尚未加入動作" : "完成後會自動結算金幣、XP 與任務。"}</span>
        <button
          className="complete-action"
          type="button"
          onClick={onCompleteWorkout}
          disabled={draftEntries.length === 0}
        >
          完成訓練
        </button>
      </div>

      {isAddExerciseOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="add-exercise-title">
            <div className="modal-head">
              <div>
                <p className="section-label">新增動作</p>
                <h2 id="add-exercise-title">紀錄一個訓練項目</h2>
              </div>
              <button className="icon-button" type="button" aria-label="關閉" onClick={() => setIsAddExerciseOpen(false)}>
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className="form-grid">
              <label>
                動作
                <select
                  value={draftEntry.exerciseId}
                  onChange={(event) =>
                    setDraftEntry((current) => ({ ...current, exerciseId: event.target.value }))
                  }
                >
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </label>

              {usesSets(selectedExercise) && (
                <label>
                  組數
                  <input
                    min="1"
                    type="number"
                    value={draftEntry.sets}
                    onChange={(event) =>
                      setDraftEntry((current) => ({ ...current, sets: Number(event.target.value) }))
                    }
                  />
                </label>
              )}

              {usesReps(selectedExercise) && (
                <label>
                  次數
                  <input
                    min="1"
                    type="number"
                    value={draftEntry.reps}
                    onChange={(event) =>
                      setDraftEntry((current) => ({ ...current, reps: Number(event.target.value) }))
                    }
                  />
                </label>
              )}

              {selectedExercise.measurementType === "reps_weight" && (
                <label>
                  重量
                  <input
                    min="0"
                    type="number"
                    value={draftEntry.weight}
                    onChange={(event) =>
                      setDraftEntry((current) => ({ ...current, weight: Number(event.target.value) }))
                    }
                  />
                </label>
              )}

              {selectedExercise.measurementType === "duration" && (
                <label>
                  分鐘
                  <input
                    min="1"
                    type="number"
                    value={draftEntry.durationMinutes}
                    onChange={(event) =>
                      setDraftEntry((current) => ({ ...current, durationMinutes: Number(event.target.value) }))
                    }
                  />
                </label>
              )}

              <label className="wide-field">
                備註
                <input
                  value={draftEntry.notes}
                  onChange={(event) =>
                    setDraftEntry((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="選填"
                />
              </label>
            </div>

            <div className="modal-actions">
              <button className="ghost-light-action" type="button" onClick={() => setIsAddExerciseOpen(false)}>
                取消
              </button>
              <button className="primary-action" type="button" onClick={submitEntry}>
                <Plus size={18} aria-hidden />
                加入清單
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function HistoryView({ workouts, exercises }: { workouts: WorkoutSession[]; exercises: Exercise[] }) {
  const completedWorkouts = [...workouts].reverse();
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  return (
    <div className="history-layout">
      <section className="history-list-surface">
        <div className="section-heading">
          <div>
            <p className="section-label">已完成訓練</p>
            <h2>歷史紀錄</h2>
          </div>
        </div>
        <div className="history-list">
          {completedWorkouts.length === 0 ? (
            <p className="empty-copy">完成訓練後會顯示在這裡。</p>
          ) : (
            completedWorkouts.map((workout) => {
              const expanded = workout.id === expandedWorkoutId;
              return (
                <article className={expanded ? "history-record expanded" : "history-record"} key={workout.id}>
                  <div className="history-row">
                    <div className="history-row-main">
                      <strong>{workout.completedAt ? formatShortDate(workout.completedAt) : "草稿"}</strong>
                      <span>
                        {workout.entries
                          .map((entry) => exercises.find((exercise) => exercise.id === entry.exerciseId)?.name)
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                    <div className="history-rewards">
                      <span>+{workout.totalCoinsEarned} 金幣</span>
                      <span>+{workout.totalXpEarned} XP</span>
                    </div>
                    <button
                      className="detail-toggle"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedWorkoutId(expanded ? null : workout.id)}
                    >
                      {expanded ? "收合" : "詳情"}
                    </button>
                  </div>
                  {expanded && (
                    <div className="inline-history-detail">
                      <div className="detail-summary">
                        <span>{workout.entries.length} 個動作</span>
                        <span>+{workout.totalCoinsEarned} 金幣</span>
                        <span>+{workout.totalXpEarned} XP</span>
                      </div>
                      <div className="detail-entry-list">
                        {workout.entries.map((entry) => {
                          const exercise = exercises.find((item) => item.id === entry.exerciseId);
                          return (
                            <div className="detail-entry-row" key={entry.id}>
                              <div className="detail-entry-main">
                                <strong>{exercise?.name}</strong>
                                <span>{exercise ? categoryLabel(exercise.category) : ""}</span>
                              </div>
                              <span className="detail-entry-value">{formatEntry(entry)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function RewardsView({
  rewards,
  coins,
  ownedRewardIds,
  onPurchaseReward,
}: {
  rewards: Reward[];
  coins: number;
  ownedRewardIds: Set<string>;
  onPurchaseReward: (reward: Reward) => void;
}) {
  return (
    <section className="shop-container">
      <div className="shop-head">
        <div>
          <p className="section-label">獎勵商店</p>
          <h2>用金幣換一點訓練樂趣</h2>
        </div>
        <strong>{coins} 金幣</strong>
      </div>
      <div className="shop-list">
        {rewards.map((reward) => {
          const owned = ownedRewardIds.has(reward.id);
          return (
            <div className="shop-item-row" key={reward.id}>
              <div className="shop-item-copy">
                <div className="shop-item-title">
                  <span className="item-type-badge">{rewardTypeLabel(reward.type)}</span>
                  <strong>{reward.name}</strong>
                </div>
                <p>{reward.description}</p>
              </div>
              <div className="shop-item-action">
                <strong>{reward.cost} 金幣</strong>
                <button
                  className="primary-action compact-action"
                  type="button"
                  disabled={owned || coins < reward.cost}
                  onClick={() => onPurchaseReward(reward)}
                >
                  {owned ? "已擁有" : "兌換"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProfileView({
  state,
  level,
  equippedReward,
  ownedRewardIds,
  onSaveProfile,
}: {
  state: GymitionState;
  level: number;
  equippedReward?: Reward;
  ownedRewardIds: Set<string>;
  onSaveProfile: (username: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(state.user.username);
  const ownedRewards = seedRewards.filter((reward) => ownedRewardIds.has(reward.id));

  function cancelEdit() {
    setUsernameDraft(state.user.username);
    setIsEditing(false);
  }

  function saveEdit() {
    const nextName = usernameDraft.trim();
    if (nextName) {
      onSaveProfile(nextName);
    }
    setIsEditing(false);
  }

  return (
    <div className="player-profile">
      <section className="profile-hero">
        <div className="player-avatar">{state.user.username.slice(0, 2).toUpperCase()}</div>
        <div className="player-identity">
          <p className="section-label">玩家檔案</p>
          {isEditing ? (
            <label className="profile-name-field">
              顯示名稱
              <input
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                autoFocus
              />
            </label>
          ) : (
            <>
              <h2>{state.user.username}</h2>
              <p>{equippedReward?.metadata.title ?? "尚未裝備稱號"}</p>
            </>
          )}
        </div>
        <div className="profile-actions">
          {isEditing ? (
            <>
              <button className="ghost-light-action" type="button" onClick={cancelEdit}>
                <X size={16} aria-hidden />
                取消
              </button>
              <button className="primary-action compact-action" type="button" onClick={saveEdit}>
                <Save size={16} aria-hidden />
                儲存
              </button>
            </>
          ) : (
            <button className="ghost-light-action" type="button" onClick={() => setIsEditing(true)}>
              <Pencil size={16} aria-hidden />
              編輯
            </button>
          )}
        </div>
      </section>

      <section className="profile-progression">
        <div>
          <p className="section-label">角色進度</p>
          <h2>等級 {level}</h2>
        </div>
        <div className="profile-level-meter">
          <div className="meter compact">
            <span style={{ width: `${Math.min(100, state.user.xp % 100)}%` }} />
          </div>
          <span>{state.user.xp} XP</span>
        </div>
      </section>

      <section className="profile-stat-lanes" aria-label="個人統計">
        <div>
          <span>金幣</span>
          <strong>{state.user.coins}</strong>
        </div>
        <div>
          <span>連續天數</span>
          <strong>{state.user.currentStreak}</strong>
        </div>
        <div>
          <span>完成訓練</span>
          <strong>{state.workouts.length}</strong>
        </div>
        <div>
          <span>收藏獎勵</span>
          <strong>{ownedRewardIds.size}</strong>
        </div>
      </section>

      <section className="profile-inventory">
        <div className="section-heading">
          <div>
            <p className="section-label">展示櫃</p>
            <h2>已擁有獎勵</h2>
          </div>
        </div>
        <div className="inventory-list">
          {ownedRewards.length === 0 ? (
            <p className="empty-copy">還沒有兌換獎勵。先完成訓練累積金幣。</p>
          ) : (
            ownedRewards.map((reward) => (
              <div className="inventory-row" key={reward.id}>
                <div className="reward-icon">
                  <ShoppingBag size={18} aria-hidden />
                </div>
                <div>
                  <strong>{reward.name}</strong>
                  <span>{rewardTypeLabel(reward.type)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <article className="stat-tile">
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function createInitialState(): GymitionState {
  return {
    user: {
      id: "local_user",
      email: "you@gymition.local",
      username: "Crasni",
      coins: 0,
      xp: 0,
      currentStreak: 0,
      lastLoginRewardDate: null,
      createdAt: new Date().toISOString(),
    },
    coinLedger: [],
    xpLedger: [],
    workouts: [],
    userRewards: [],
    questRewards: {},
  };
}

function applyAutoQuestRewards(state: GymitionState): GymitionState {
  const today = localDateKey();
  const progress = calculateQuestProgress(state, dailyQuests, seedExercises, today);
  let nextState = state;

  for (const quest of dailyQuests) {
    const questState = progress.find((item) => item.questId === quest.id);
    const key = getDailyQuestKey(quest.id, today);
    if (!questState?.completed || nextState.questRewards[key]) {
      continue;
    }

    nextState = {
      ...nextState,
      user: {
        ...nextState.user,
        coins: nextState.user.coins + quest.coinReward,
        xp: nextState.user.xp + quest.xpReward,
      },
      questRewards: {
        ...nextState.questRewards,
        [key]: new Date().toISOString(),
      },
      coinLedger: [
        ...nextState.coinLedger,
        createLedgerEntry(quest.coinReward, "quest_completed", "quest", quest.id),
      ],
      xpLedger: [
        ...nextState.xpLedger,
        createLedgerEntry(quest.xpReward, "quest_completed", "quest", quest.id),
      ],
    };
  }

  return nextState;
}

function usesSets(exercise: Exercise) {
  return exercise.measurementType === "reps_weight" || exercise.measurementType === "reps_only";
}

function usesReps(exercise: Exercise) {
  return exercise.measurementType === "reps_weight" || exercise.measurementType === "reps_only";
}

function getDailyQuoteIndex(dateKey: string) {
  return [...dateKey].reduce((total, character) => total + character.charCodeAt(0), 0) % motivationalQuotes.length;
}

function categoryLabel(category: Exercise["category"]) {
  const labels: Record<Exercise["category"], string> = {
    chest: "胸部",
    back: "背部",
    legs: "腿部",
    shoulders: "肩膀",
    arms: "手臂",
    core: "核心",
    cardio: "有氧",
    mobility: "活動度",
  };

  return labels[category];
}

function formatEntry(entry: WorkoutEntry) {
  if (entry.durationSeconds) {
    return `${Math.round(entry.durationSeconds / 60)} 分鐘`;
  }
  if (entry.sets && entry.reps && entry.weight !== undefined) {
    return `${entry.sets} 組 x ${entry.reps} 下，${entry.weight} kg`;
  }
  if (entry.sets && entry.reps) {
    return `${entry.sets} 組 x ${entry.reps} 下`;
  }
  return "已完成";
}

function ledgerReasonLabel(reason: LedgerReason) {
  const labels: Record<LedgerReason, string> = {
    daily_login: "每日登入",
    workout_completed: "完成訓練",
    exercise_logged: "紀錄動作",
    quest_completed: "完成任務",
    streak_bonus: "連續天數加成",
    reward_purchase: "兌換獎勵",
    manual_adjustment: "手動調整",
  };

  return labels[reason];
}

function rewardTypeLabel(type: Reward["type"]) {
  const labels: Record<Reward["type"], string> = {
    title: "稱號",
    badge: "勛章",
    theme: "主題",
    avatar_item: "造型",
    custom: "自訂",
  };

  return labels[type];
}
