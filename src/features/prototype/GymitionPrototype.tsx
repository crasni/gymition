"use client";

import {
  Check,
  CircleDollarSign,
  Flame,
  Gift,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
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
          ownedRewardIds={ownedRewardIds}
          onClaimDailyReward={claimDailyReward}
          onPurchaseReward={purchaseReward}
          dailyClaimed={state.user.lastLoginRewardDate === localDateKey()}
          equippedReward={equippedReward}
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
  ownedRewardIds,
  onClaimDailyReward,
  onPurchaseReward,
  dailyClaimed,
  equippedReward,
}: {
  state: GymitionState;
  level: number;
  questProgress: ReturnType<typeof calculateQuestProgress>;
  recentLedger: LedgerEntry[];
  ownedRewardIds: Set<string>;
  onClaimDailyReward: () => void;
  onPurchaseReward: (reward: Reward) => void;
  dailyClaimed: boolean;
  equippedReward?: Reward;
}) {
  return (
    <div className="dashboard-grid">
      <section className="stat-strip">
        <StatTile label="金幣" value={state.user.coins.toString()} icon={<CircleDollarSign size={19} />} />
        <StatTile label="XP 等級" value={`等級 ${level}`} icon={<Sparkles size={19} />} />
        <StatTile label="連續天數" value={`${state.user.currentStreak} 天`} icon={<Flame size={19} />} />
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-main-column">
          <section className="panel daily-panel">
            <div>
              <p className="section-label">每日獎勵</p>
              <h2>{dailyClaimed ? "今天已領取" : "領取今日啟動獎勵"}</h2>
              <p>
                {dailyClaimed
                  ? "明天再回來延續連續天數。"
                  : `獲得 ${REWARD_RULES.dailyLogin.coins} 金幣、${REWARD_RULES.dailyLogin.xp} XP，並計算連續登入加成。`}
              </p>
            </div>
            <button className="primary-action" type="button" onClick={onClaimDailyReward} disabled={dailyClaimed}>
              <Gift size={18} aria-hidden />
              {dailyClaimed ? "已領取" : "領取獎勵"}
            </button>
          </section>

          <section className="panel activity-panel">
            <p className="section-label">近期獎勵事件</p>
            <h2>金幣與 XP 紀錄</h2>
            <div className="ledger-list">
              {recentLedger.length === 0 ? (
                <p className="empty-copy">領取獎勵或完成訓練後，這裡會顯示紀錄。</p>
              ) : (
                recentLedger.map((entry) => (
                  <div className="ledger-row" key={entry.id}>
                    <span>{ledgerReasonLabel(entry.reason)}</span>
                    <strong>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="dashboard-side-column">
          <section className="panel">
            <div className="section-heading">
          <div>
            <p className="section-label">今日任務</p>
            <h2>自動結算目標</h2>
          </div>
            </div>
            <div className="quest-list">
              {dailyQuests.map((quest) => {
                const progress = questProgress.find((item) => item.questId === quest.id);
                const value = Math.min(progress?.progress ?? 0, quest.targetValue);
                const percent = Math.round((value / quest.targetValue) * 100);
                return (
                  <div className="quest-row" key={quest.id}>
                    <div>
                      <strong>{quest.name}</strong>
                      <span>{quest.description}</span>
                    </div>
                    <div className="quest-progress">
                      <span>
                        {value}/{quest.targetValue}
                      </span>
                      <div className="meter compact">
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      {progress?.rewarded && <Check size={17} aria-label="已獲得獎勵" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel reward-preview">
            <p className="section-label">商店預覽</p>
            <h2>{equippedReward ? equippedReward.name : "第一個可兌換獎勵"}</h2>
            <p>
              {equippedReward
                ? "已顯示在個人檔案。"
                : "花費金幣不會影響永久 XP 進度。"}
            </p>
            {seedRewards.slice(0, 2).map((reward) => (
              <button
                className="shop-row"
                key={reward.id}
                type="button"
                disabled={ownedRewardIds.has(reward.id) || state.user.coins < reward.cost}
                onClick={() => onPurchaseReward(reward)}
              >
                <span>{reward.name}</span>
                <strong>{ownedRewardIds.has(reward.id) ? "已擁有" : `${reward.cost} 金幣`}</strong>
              </button>
            ))}
          </section>
        </div>
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
  const selectedExercise = exercises.find((exercise) => exercise.id === draftEntry.exerciseId) ?? exercises[0];

  return (
    <div className="two-column">
      <section className="panel">
        <p className="section-label">動作紀錄</p>
        <h2>新增一組訓練內容</h2>
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
        <button className="primary-action" type="button" onClick={onAddEntry}>
          <Plus size={18} aria-hidden />
          新增動作
        </button>
      </section>

      <section className="panel">
        <p className="section-label">目前訓練</p>
        <h2>已紀錄 {draftEntries.length} 個動作</h2>
        <div className="entry-list">
          {draftEntries.length === 0 ? (
            <p className="empty-copy">至少新增一個動作後才能完成訓練。</p>
          ) : (
            draftEntries.map((entry) => {
              const exercise = exercises.find((item) => item.id === entry.exerciseId);
              return (
                <div className="entry-row" key={entry.id}>
                  <div>
                    <strong>{exercise?.name}</strong>
                    <span>{formatEntry(entry)}</span>
                  </div>
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
        <button
          className="complete-action"
          type="button"
          onClick={onCompleteWorkout}
          disabled={draftEntries.length === 0}
        >
          完成訓練
        </button>
      </section>
    </div>
  );
}

function HistoryView({ workouts, exercises }: { workouts: WorkoutSession[]; exercises: Exercise[] }) {
  return (
    <section className="panel full-panel">
      <p className="section-label">已完成訓練</p>
      <h2>歷史紀錄</h2>
      <div className="history-list">
        {workouts.length === 0 ? (
          <p className="empty-copy">完成訓練後會顯示在這裡。</p>
        ) : (
          [...workouts].reverse().map((workout) => (
            <article className="history-row" key={workout.id}>
              <div>
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
            </article>
          ))
        )}
      </div>
    </section>
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
    <section className="reward-grid">
      {rewards.map((reward) => {
        const owned = ownedRewardIds.has(reward.id);
        return (
          <article className="panel reward-card" key={reward.id}>
            <div className="reward-icon">
              <ShoppingBag size={22} aria-hidden />
            </div>
            <p className="section-label">{rewardTypeLabel(reward.type)}</p>
            <h2>{reward.name}</h2>
            <p>{reward.description}</p>
            <button
              className="complete-action"
              type="button"
              disabled={owned || coins < reward.cost}
              onClick={() => onPurchaseReward(reward)}
            >
              {owned ? "已擁有" : `${reward.cost} 金幣`}
            </button>
          </article>
        );
      })}
    </section>
  );
}

function ProfileView({
  state,
  level,
  equippedReward,
  ownedRewardIds,
}: {
  state: GymitionState;
  level: number;
  equippedReward?: Reward;
  ownedRewardIds: Set<string>;
}) {
  return (
    <div className="two-column">
      <section className="panel profile-card">
        <div className="avatar">{state.user.username.slice(0, 2).toUpperCase()}</div>
        <p className="section-label">本地使用者</p>
        <h2>{state.user.username}</h2>
        <p>{equippedReward?.metadata.title ?? "尚未裝備稱號"}</p>
      </section>
      <section className="panel">
        <p className="section-label">進度</p>
        <h2>Phase 0 個人狀態</h2>
        <div className="profile-stats">
          <span>等級 {level}</span>
          <span>{state.user.xp} XP</span>
          <span>{state.user.coins} 金幣</span>
          <span>連續 {state.user.currentStreak} 天</span>
          <span>完成 {state.workouts.length} 次訓練</span>
          <span>擁有 {ownedRewardIds.size} 個獎勵</span>
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
      username: "本地訓練者",
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
  };

  return labels[reason];
}

function rewardTypeLabel(type: Reward["type"]) {
  const labels: Record<Reward["type"], string> = {
    title: "稱號",
    badge: "徽章",
    theme: "主題",
    custom: "自訂",
  };

  return labels[type];
}
