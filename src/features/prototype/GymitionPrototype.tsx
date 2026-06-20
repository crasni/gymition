"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Droplets,
  Dumbbell,
  Flame,
  Gift,
  HeartPulse,
  Pencil,
  Plus,
  Save,
  ShoppingBag,
  SmilePlus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  LifeCheckinSummary,
  LifeHabitCheckin,
  LifeHabitType,
  Quest,
  Reward,
  WorkoutEntry,
  WorkoutSession,
} from "@/features/economy/types";
import { seedExercises } from "@/features/exercises/seed-exercises";
import { calculateLifeStreak, getLifeHabitMap, isLifeDayComplete } from "@/features/life/life-streak";
import { calculateQuestProgress, getDailyQuestKey } from "@/features/quests/quest-engine";
import { dailyQuests } from "@/features/quests/quest-rules";
import { seedRewards } from "@/features/rewards/reward-service";
import { nextLoginStreak } from "@/features/streaks/streak-service";
import { formatShortDate, localDateKey } from "@/lib/dates";
import { createId } from "@/lib/ids";

type AppView = "dashboard" | "workout" | "history" | "rewards" | "life" | "profile";

type ServerActions = {
  claimDailyReward?: () => Promise<DailyCheckinSummary>;
  completeWorkout?: (input:
    | {
        mode: "detailed";
        entries: Array<{
          exerciseId: string;
          sets?: number;
          reps?: number;
          weight?: number;
          durationSeconds?: number;
          distanceMeters?: number;
          notes?: string;
        }>;
      }
    | {
        mode: "simple";
        durationSeconds: number;
        notes?: string;
      }) => Promise<void>;
  purchaseReward?: (input: { rewardId: string }) => Promise<void>;
  updateProfile?: (input: { username: string }) => Promise<void>;
  resetProfileData?: () => Promise<void>;
  setWeeklyGoal?: (input: { workoutTarget: number; cardioTarget: number }) => Promise<void>;
  checkinLifeHabit?: (input: { habitType: LifeHabitType }) => Promise<LifeCheckinSummary>;
};

type DailyCheckinSummary = {
  coins: number;
  xp: number;
  streak: number;
  streakBonus: number;
};

type DraftEntry = {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number;
  durationMinutes: number;
  distanceMeters: number;
  notes: string;
};

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
    line: "Log the first set. Let the rhythm take over.",
    note: "Once the first movement is written down, the workout has already started.",
  },
  {
    line: "You do not need a huge session. You need a recorded one.",
    note: "Weights, reps, and minutes tell a cleaner story than memory does.",
  },
  {
    line: "Today only has to beat the version that never started.",
    note: "Keep it small if needed. Fill the workout list first.",
  },
  {
    line: "Your body remembers what you repeat.",
    note: "Coins, XP, and quests settle automatically after each workout.",
  },
  {
    line: "Clean reps beat a crowded log.",
    note: "Track one movement at a time so today stays easy to read.",
  },
  {
    line: "Own the next ten minutes.",
    note: "Autonomy keeps training personal. Pick the smallest honest start and take it.",
  },
  {
    line: "A logged workout is proof, not a promise.",
    note: "Make progress visible today, then let tomorrow earn its own mark.",
  },
  {
    line: "Do the version you can repeat.",
    note: "The session that fits your life is the one most likely to survive the week.",
  },
  {
    line: "Restart fast. That is the skill.",
    note: "Missing a day matters less than making the next entry obvious.",
  },
  {
    line: "Train for a reason you respect.",
    note: "Performance, energy, confidence, or calm all count when they are yours.",
  },
  {
    line: "Keep the bar low enough to step over.",
    note: "Momentum is built by completed reps, not perfect intentions.",
  },
  {
    line: "Your streak is just attendance with memory.",
    note: "Show up, record the work, and let the count stay honest.",
  },
  {
    line: "Make competence visible.",
    note: "A few tracked numbers can turn a vague workout into a repeatable system.",
  },
] as const;

const lifeHabitMeta = {
  face_wash: {
    label: "Wash face",
    note: "Start clean and mark the day with one small win.",
    Icon: Droplets,
  },
  tooth_brush: {
    label: "Brush teeth",
    note: "Small done things become rhythm.",
    Icon: SmilePlus,
  },
} satisfies Record<LifeHabitType, { label: string; note: string; Icon: typeof Droplets }>;

export function GymitionPrototype({
  initialView,
  initialState,
  exercises = seedExercises,
  quests = dailyQuests,
  rewards = seedRewards,
  actions = {},
}: {
  initialView: AppView;
  initialState?: GymitionState;
  exercises?: Exercise[];
  quests?: Quest[];
  rewards?: Reward[];
  actions?: ServerActions;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localState, setLocalState] = useState(createInitialState());
  const [optimisticState, setOptimisticState] = useState<GymitionState | null>(null);
  const lastServerStateRef = useRef(initialState);
  const state = optimisticState ?? initialState ?? localState;
  const [draftEntry, setDraftEntry] = useState({
    ...defaultDraftEntry,
    exerciseId: exercises[0]?.id ?? defaultDraftEntry.exerciseId,
  });
  const [draftEntries, setDraftEntries] = useState<WorkoutEntry[]>([]);
  const [workoutMode, setWorkoutMode] = useState<"detailed" | "simple">("detailed");
  const [simpleDurationMinutes, setSimpleDurationMinutes] = useState(30);
  const [simpleWorkoutNotes, setSimpleWorkoutNotes] = useState("");
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [dailyCheckinSummary, setDailyCheckinSummary] = useState<DailyCheckinSummary | null>(null);
  const [lifeCheckinSummary, setLifeCheckinSummary] = useState<LifeCheckinSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!initialState || lastServerStateRef.current === initialState) {
      return;
    }

    lastServerStateRef.current = initialState;
    setOptimisticState(null);
  }, [initialState]);

  useEffect(() => {
    if (!lifeCheckinSummary || lifeCheckinSummary.todayCompleted) {
      return;
    }

    const timeout = window.setTimeout(() => setLifeCheckinSummary(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [lifeCheckinSummary]);

  useEffect(() => {
    if (!actionError) {
      return;
    }

    const timeout = window.setTimeout(() => setActionError(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [actionError]);

  const questProgress = useMemo(
    () => calculateQuestProgress(state, quests, exercises),
    [exercises, quests, state],
  );
  const recentLedger = [...state.coinLedger, ...state.xpLedger]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const level = levelFromXp(state.user.xp);
  const ownedRewardIds = new Set(state.userRewards.map((reward) => reward.rewardId));
  const equippedReward = rewards.find((reward) =>
    state.userRewards.some((userReward) => userReward.rewardId === reward.id && userReward.equippedAt),
  );

  function markActionPending(key: string) {
    setPendingActions((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function clearActionPending(key: string) {
    setPendingActions((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function runServerAction(action: () => Promise<void>, key = "global") {
    if (pendingActions.has(key)) {
      return;
    }

    markActionPending(key);
    startTransition(async () => {
      try {
        setActionError(null);
        await action();
        router.refresh();
      } catch {
        setActionError("The action did not finish. Please try again.");
        router.refresh();
      } finally {
        clearActionPending(key);
      }
    });
  }

  function applyStateUpdate(updater: (current: GymitionState) => GymitionState) {
    if (initialState) {
      setOptimisticState((current) => updater(current ?? state));
      return;
    }

    setLocalState(updater);
  }

  function clearWorkoutDraft() {
    setDraftEntries([]);
    setSimpleWorkoutNotes("");
  }

  function claimDailyReward() {
    const today = localDateKey();
    if (state.user.lastLoginRewardDate === today || pendingActions.has("daily-reward")) {
      return;
    }

    if (actions.claimDailyReward) {
      const nextStreak = nextLoginStreak(state.user.lastLoginRewardDate, state.user.currentStreak);
      const streakBonus = calculateStreakBonus(nextStreak);
      const totalCoins = REWARD_RULES.dailyLogin.coins + streakBonus;
      const summary = {
        coins: totalCoins,
        xp: REWARD_RULES.dailyLogin.xp,
        streak: nextStreak,
        streakBonus,
      };

      setDailyCheckinSummary(summary);
      applyStateUpdate((current) => ({
        ...current,
        user: {
          ...current.user,
          coins: current.user.coins + totalCoins,
          xp: current.user.xp + REWARD_RULES.dailyLogin.xp,
          currentStreak: nextStreak,
          lastLoginRewardDate: today,
        },
        dailyCheckins: [
          {
            id: createId("checkin"),
            checkinDate: today,
            streakDay: nextStreak,
            coinsEarned: REWARD_RULES.dailyLogin.coins,
            xpEarned: REWARD_RULES.dailyLogin.xp,
            streakBonusCoins: streakBonus,
            createdAt: new Date().toISOString(),
          },
          ...current.dailyCheckins,
        ],
        coinLedger: [
          ...current.coinLedger,
          createLedgerEntry(REWARD_RULES.dailyLogin.coins, "daily_login", "login", today),
          createLedgerEntry(streakBonus, "streak_bonus", "login", today),
        ],
        xpLedger: [
          ...current.xpLedger,
          createLedgerEntry(REWARD_RULES.dailyLogin.xp, "daily_login", "login", today),
        ],
      }));

      runServerAction(async () => {
        const serverSummary = await actions.claimDailyReward?.();
        if (serverSummary) {
          setDailyCheckinSummary(serverSummary);
        }
      }, "daily-reward");
      return;
    }

    applyStateUpdate((current) => {
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
        dailyCheckins: [
          {
            id: createId("checkin"),
            checkinDate: today,
            streakDay: nextStreak,
            coinsEarned: REWARD_RULES.dailyLogin.coins,
            xpEarned: REWARD_RULES.dailyLogin.xp,
            streakBonusCoins: streakBonus,
            createdAt: new Date().toISOString(),
          },
          ...current.dailyCheckins,
        ],
        coinLedger: [...current.coinLedger, ...coinLedger],
        xpLedger: [...current.xpLedger, ...xpLedger],
      };
    });
  }

  function addDraftEntry() {
    const exercise = exercises.find((item) => item.id === draftEntry.exerciseId);
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
    const simpleDurationSeconds = clampInteger(simpleDurationMinutes, 1, 24 * 60) * 60;
    if (pendingActions.has("workout")) {
      return;
    }

    if (workoutMode === "detailed" && draftEntries.length === 0) {
      return;
    }

    if (workoutMode === "simple" && simpleDurationSeconds < 60) {
      return;
    }

    const submittedMode = workoutMode;
    const submittedEntries = [...draftEntries];
    const submittedDurationSeconds = simpleDurationSeconds;
    const submittedNotes = simpleWorkoutNotes;
    const optimisticNow = new Date().toISOString();
    const optimisticWorkoutId = createId("workout");

    applyStateUpdate((current) =>
      applyCompletedWorkoutState(current, {
        id: optimisticWorkoutId,
        mode: submittedMode,
        entries: submittedMode === "detailed" ? submittedEntries : [],
        durationSeconds: submittedMode === "simple" ? submittedDurationSeconds : undefined,
        notes: submittedMode === "simple" ? submittedNotes.trim() || undefined : undefined,
        completedAt: optimisticNow,
        hasCardio: submittedEntries.some(
          (entry) => exercises.find((exercise) => exercise.id === entry.exerciseId)?.category === "cardio",
        ),
      }),
    );
    const coinTotal =
      (submittedMode === "detailed" ? submittedEntries.reduce((total, entry) => total + entry.coinsEarned, 0) : 0) +
      REWARD_RULES.workoutCompleted.coins;
    const xpTotal =
      (submittedMode === "detailed" ? submittedEntries.reduce((total, entry) => total + entry.xpEarned, 0) : 0) +
      REWARD_RULES.workoutCompleted.xp;
    setLastSummary(`Workout complete: +${coinTotal} coins and +${xpTotal} XP before quest rewards.`);
    clearWorkoutDraft();

    if (actions.completeWorkout) {
      runServerAction(async () => {
        if (submittedMode === "simple") {
          await actions.completeWorkout?.({
            mode: "simple",
            durationSeconds: submittedDurationSeconds,
            notes: submittedNotes,
          });
        } else {
          await actions.completeWorkout?.({
            mode: "detailed",
            entries: submittedEntries.map((entry) => ({
              exerciseId: entry.exerciseId,
              sets: entry.sets,
              reps: entry.reps,
              weight: entry.weight,
              durationSeconds: entry.durationSeconds,
              distanceMeters: entry.distanceMeters,
              notes: entry.notes,
            })),
          });
        }
        setLastSummary("Workout complete.");
      }, "workout");
      return;
    }
  }

  function purchaseReward(reward: Reward) {
    const actionKey = `reward-${reward.id}`;
    if (state.user.coins < reward.cost || ownedRewardIds.has(reward.id) || pendingActions.has(actionKey)) {
      return;
    }

    applyStateUpdate((current) => ({
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

    if (actions.purchaseReward) {
      runServerAction(async () => {
        await actions.purchaseReward?.({ rewardId: reward.id });
      }, actionKey);
    }
  }

  function resetDemo() {
    if (initialState) {
      router.refresh();
      return;
    }

    const freshState = createInitialState();
    setLocalState(freshState);
    setDraftEntries([]);
    setWorkoutMode("detailed");
    setSimpleDurationMinutes(30);
    setSimpleWorkoutNotes("");
    setLastSummary(null);
  }

  function saveProfile(username: string) {
    if (pendingActions.has("profile")) {
      return;
    }

    applyStateUpdate((current) => ({
      ...current,
      user: {
        ...current.user,
        username,
      },
    }));

    if (actions.updateProfile) {
      runServerAction(async () => {
        await actions.updateProfile?.({ username });
      }, "profile");
      return;
    }
  }

  function resetProfileData() {
    if (pendingActions.has("reset-profile")) {
      return;
    }

    applyStateUpdate((current) => resetAppDataState(current));
    setDraftEntries([]);
    setWorkoutMode("detailed");
    setSimpleDurationMinutes(30);
    setSimpleWorkoutNotes("");
    setLastSummary(null);

    if (actions.resetProfileData) {
      runServerAction(async () => {
        await actions.resetProfileData?.();
      }, "reset-profile");
      return;
    }
  }

  function setWeeklyGoal(input: { workoutTarget: number; cardioTarget: number }) {
    if (pendingActions.has("weekly-goal")) {
      return;
    }

    applyStateUpdate((current) => ({
      ...current,
      weeklyGoal: {
        id: current.weeklyGoal?.id ?? "optimistic_weekly_goal",
        weekStart: current.weeklyGoal?.weekStart ?? localDateKey(),
        workoutTarget: input.workoutTarget,
        cardioTarget: input.cardioTarget,
      },
    }));

    if (actions.setWeeklyGoal) {
      runServerAction(async () => {
        await actions.setWeeklyGoal?.(input);
      }, "weekly-goal");
      return;
    }
  }

  function checkinLifeHabit(habitType: LifeHabitType) {
    const today = localDateKey();
    const actionKey = `life-${habitType}`;
    const alreadyCompleted = state.lifeHabitCheckins.some(
      (checkin) => checkin.checkinDate === today && checkin.habitType === habitType,
    );

    if (alreadyCompleted || pendingActions.has(actionKey)) {
      return;
    }

    let optimisticSummary: LifeCheckinSummary | null = null;
    applyStateUpdate((current) => {
      const nextCheckins: LifeHabitCheckin[] = [
        ...current.lifeHabitCheckins,
        {
          id: createId("life_checkin"),
          checkinDate: today,
          habitType,
          createdAt: new Date().toISOString(),
        },
      ];
      const todayHabits = getLifeHabitMap(nextCheckins).get(today);
      const summary: LifeCheckinSummary = {
        habitType,
        alreadyCompleted: false,
        todayCompleted: isLifeDayComplete(todayHabits),
        todayCompletedCount: todayHabits?.size ?? 0,
        streak: calculateLifeStreak(nextCheckins),
      };

      optimisticSummary = summary;

      return {
        ...current,
        lifeHabitCheckins: nextCheckins,
        lifeSummary: {
          streak: summary.streak,
          todayCompleted: summary.todayCompleted,
          todayCompletedCount: summary.todayCompletedCount,
        },
      };
    });

    if (optimisticSummary) {
      setLifeCheckinSummary(optimisticSummary);
    }

    if (actions.checkinLifeHabit) {
      runServerAction(async () => {
        const summary = await actions.checkinLifeHabit?.({ habitType });
        if (summary) {
          setLifeCheckinSummary(summary);
        }
      }, actionKey);
    }
  }

  return (
    <AppShell
      activeView={initialView}
      coins={state.user.coins}
      xp={state.user.xp}
      streak={state.user.currentStreak}
      username={state.user.username}
      onReset={resetDemo}
      resetLabel={initialState ? "Refresh data" : "Reset demo data"}
    >
      {initialView === "dashboard" && (
        <DashboardView
          state={state}
          level={level}
          questProgress={questProgress}
          recentLedger={recentLedger}
          onClaimDailyReward={claimDailyReward}
          dailyClaimed={state.user.lastLoginRewardDate === localDateKey() || pendingActions.has("daily-reward")}
          quests={quests}
          onSetWeeklyGoal={setWeeklyGoal}
          goalPending={pendingActions.has("weekly-goal")}
        />
      )}

      {initialView === "workout" && (
        <WorkoutView
          draftEntry={draftEntry}
          draftEntries={draftEntries}
          exercises={exercises}
          lastSummary={lastSummary}
          mode={workoutMode}
          simpleDurationMinutes={simpleDurationMinutes}
          simpleNotes={simpleWorkoutNotes}
          setDraftEntry={setDraftEntry}
          setMode={setWorkoutMode}
          setSimpleDurationMinutes={setSimpleDurationMinutes}
          setSimpleNotes={setSimpleWorkoutNotes}
          onAddEntry={addDraftEntry}
          onRemoveEntry={(entryId) =>
            setDraftEntries((entries) => entries.filter((entry) => entry.id !== entryId))
          }
          onCompleteWorkout={completeWorkout}
        />
      )}

      {initialView === "history" && <HistoryView workouts={state.workouts} exercises={exercises} />}

      {initialView === "rewards" && (
        <RewardsView
          rewards={rewards}
          coins={state.user.coins}
          ownedRewardIds={ownedRewardIds}
          onPurchaseReward={purchaseReward}
        />
      )}

      {initialView === "life" && (
        <LifeView
          checkins={state.lifeHabitCheckins}
          summary={state.lifeSummary}
          pendingActions={pendingActions}
          onCheckin={checkinLifeHabit}
        />
      )}

      {initialView === "profile" && (
        <ProfileView
          state={state}
          level={level}
          equippedReward={equippedReward}
          ownedRewardIds={ownedRewardIds}
          rewards={rewards}
          onSaveProfile={saveProfile}
          onResetProfileData={resetProfileData}
          resetPending={pendingActions.has("reset-profile")}
        />
      )}
      {dailyCheckinSummary && (
        <StreakCelebration
          title="Check-in streak complete"
          label="Check-in streak"
          streak={dailyCheckinSummary.streak}
          detail={`+${dailyCheckinSummary.coins} coins · +${dailyCheckinSummary.xp} XP`}
          onDismiss={() => setDailyCheckinSummary(null)}
        />
      )}
      {lifeCheckinSummary?.todayCompleted && (
        <StreakCelebration
          title="Life streak complete"
          label="Life streak"
          streak={lifeCheckinSummary.streak}
          detail="Face washed · Teeth brushed"
          onDismiss={() => setLifeCheckinSummary(null)}
        />
      )}
      {lifeCheckinSummary && !lifeCheckinSummary.todayCompleted && (
        <div
          className="checkin-toast"
          role="status"
          aria-live="polite"
        >
          <div className="checkin-toast-icon">
            <BadgeCheck size={28} aria-hidden />
          </div>
          <div>
            <strong>{lifeHabitMeta[lifeCheckinSummary.habitType].label} complete</strong>
            <span>Today&apos;s progress: {lifeCheckinSummary.todayCompletedCount}/2</span>
          </div>
        </div>
      )}
      {actionError && (
        <div className="checkin-toast error" role="status" aria-live="polite">
          <div>
            <strong>Action failed</strong>
            <span>{actionError}</span>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StreakCelebration({
  title,
  label,
  streak,
  detail,
  onDismiss,
}: {
  title: string;
  label: string;
  streak: number;
  detail: string;
  onDismiss: () => void;
}) {
  return (
    <div className="streak-celebration-backdrop" role="presentation" onClick={onDismiss}>
      <section
        className="streak-celebration"
        role="status"
        aria-live="polite"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="streak-dismiss" type="button" aria-label="Dismiss streak popup" onClick={onDismiss}>
          <X size={16} aria-hidden />
        </button>
        <div className="streak-checkmark" aria-hidden>
          <Check size={42} />
        </div>
        <p className="section-label">{title}</p>
        <h2>{streak} days</h2>
        <strong>{label}</strong>
        <span>{detail}</span>
      </section>
    </div>
  );
}

function DashboardView({
  state,
  level,
  questProgress,
  recentLedger,
  onClaimDailyReward,
  dailyClaimed,
  quests,
  onSetWeeklyGoal,
  goalPending,
}: {
  state: GymitionState;
  level: number;
  questProgress: ReturnType<typeof calculateQuestProgress>;
  recentLedger: LedgerEntry[];
  onClaimDailyReward: () => void;
  dailyClaimed: boolean;
  quests: Quest[];
  onSetWeeklyGoal: (input: { workoutTarget: number; cardioTarget: number }) => void;
  goalPending: boolean;
}) {
  const completedQuestCount = questProgress.filter((item) => item.completed).length;
  const totalQuestCount = quests.length;
  const quote = motivationalQuotes[getQuoteIndex()];

  return (
    <div className="home-layout">
      <section className="hero-command">
        <div className="hero-copy">
          <h2>{quote.line}</h2>
          <p>{quote.note}</p>
        </div>
        <div className="hero-actions">
          <a className="start-workout-action" href="/workout">
            <Dumbbell size={20} aria-hidden />
            Start workout
            <ArrowRight size={18} aria-hidden />
          </a>
          <button className="daily-reward-row" type="button" onClick={onClaimDailyReward} disabled={dailyClaimed}>
            <Gift size={20} aria-hidden />
            <span>
              <strong>{dailyClaimed ? "Daily reward claimed" : "Claim daily reward"}</strong>
              <small>
                {dailyClaimed
                  ? "Come back tomorrow to keep the check-in streak alive"
                  : `+${REWARD_RULES.dailyLogin.coins} coins, +${REWARD_RULES.dailyLogin.xp} XP`}
              </small>
            </span>
          </button>
        </div>
      </section>

      <section className="status-strip" aria-label="Current progress">
        <StatTile label="Coins" value={state.user.coins.toString()} icon={<CircleDollarSign size={19} />} />
        <StatTile label="Level" value={`${level}`} icon={<Sparkles size={19} />} />
        <StatTile label="Check-in streak" value={`${state.user.currentStreak} days`} icon={<Flame size={19} />} />
      </section>

      <div className="workbench-grid">
        <div className="workbench-main">
          <WeeklyGoalPanel
            key={`${state.weeklyGoal?.id ?? "new"}:${state.weeklyGoal?.workoutTarget ?? 0}:${state.weeklyGoal?.cardioTarget ?? 0}`}
            state={state}
            onSetWeeklyGoal={onSetWeeklyGoal}
            pending={goalPending}
          />

          <section className="activity-panel">
            <div className="section-heading">
              <div>
                <p className="section-label">Recent activity</p>
                <h2>Latest rewards</h2>
              </div>
            </div>
            <div className="ledger-list">
              {recentLedger.length === 0 ? (
                <p className="empty-copy">No activity yet.</p>
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
                <p className="section-label">Daily quests</p>
                <h2>{completedQuestCount}/{totalQuestCount} complete</h2>
              </div>
              <CalendarDays size={18} aria-hidden />
            </div>
            <div className="quest-list">
              {quests.map((quest) => {
                const progress = questProgress.find((item) => item.questId === quest.id);
                const value = Math.min(progress?.progress ?? 0, quest.targetValue);
                const percent = Math.round((value / quest.targetValue) * 100);
                const progressLabel = formatQuestProgress(quest, value);
                return (
                  <div className={progress?.completed ? "quest-row done" : "quest-row"} key={quest.id}>
                    <div className="quest-check">{progress?.completed ? <Check size={15} aria-hidden /> : null}</div>
                    <div className="quest-content">
                      <div className="quest-title-row">
                        <strong>{quest.name}</strong>
                        <span>{progressLabel}</span>
                      </div>
                      <div className="quest-progress">
                        <div className="meter compact">
                          <span style={{ width: `${percent}%` }} />
                        </div>
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

function LifeView({
  checkins,
  summary,
  pendingActions,
  onCheckin,
}: {
  checkins: LifeHabitCheckin[];
  summary: GymitionState["lifeSummary"];
  pendingActions: Set<string>;
  onCheckin: (habitType: LifeHabitType) => void;
}) {
  const today = localDateKey();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(`${today}T00:00:00`));
  const habitsByDate = useMemo(() => getLifeHabitMap(checkins), [checkins]);
  const todayHabits = habitsByDate.get(today);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const monthTitle = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
  }).format(visibleMonth);

  function shiftMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function jumpToToday() {
    setVisibleMonth(new Date(`${today}T00:00:00`));
  }

  return (
    <div className="life-layout">
      <section className="life-hero">
        <div>
          <p className="section-label">Life streak</p>
          <h2>{summary.todayCompleted ? "Today's life check-in is complete" : "Check off both daily basics"}</h2>
          <p>Wash your face and brush your teeth to extend your Life streak.</p>
        </div>
        <div className="life-scoreboard" aria-label="Life streak status">
          <div>
            <Flame size={20} aria-hidden />
            <span>Streak</span>
            <strong>{summary.streak} days</strong>
          </div>
          <div>
            <CheckCircle2 size={20} aria-hidden />
            <span>Today</span>
            <strong>{summary.todayCompletedCount}/2</strong>
          </div>
        </div>
      </section>

      <section className="life-checkin-grid" aria-label="Today's life check-ins">
        {(["face_wash", "tooth_brush"] as const).map((habitType) => {
          const meta = lifeHabitMeta[habitType];
          const completed = todayHabits?.has(habitType) ?? false;
          const pending = pendingActions.has(`life-${habitType}`);
          const Icon = meta.Icon;

          return (
            <button
              className={completed ? "life-checkin-card done" : "life-checkin-card"}
              disabled={completed || pending}
              key={habitType}
              onClick={() => onCheckin(habitType)}
              type="button"
            >
              <span className="life-checkin-icon">
                {completed ? <Check size={22} aria-hidden /> : <Icon size={24} aria-hidden />}
              </span>
              <span>
                <strong>{meta.label}</strong>
                <small>{completed ? "Checked in today" : meta.note}</small>
              </span>
            </button>
          );
        })}
      </section>

      <section className="life-calendar-panel">
        <div className="life-calendar-head">
          <div>
            <p className="section-label">Calendar</p>
            <h2>{monthTitle}</h2>
          </div>
          <div className="calendar-controls">
            <button className="ghost-light-action compact-action" type="button" onClick={jumpToToday}>
              Today
            </button>
            <button className="icon-button" type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button className="icon-button" type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>

        <div className="life-calendar-grid" aria-label="Life habit calendar">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
            <span className="calendar-weekday" key={weekday}>
              {weekday}
            </span>
          ))}
          {calendarDays.map((day, index) => {
            if (!day) {
              return <span className="life-calendar-day empty" key={`empty-${index}`} aria-hidden />;
            }

            const habits = habitsByDate.get(day.dateKey);
            const complete = isLifeDayComplete(habits);
            const isToday = day.dateKey === today;

            return (
              <div
                className={[
                  "life-calendar-day",
                  complete ? "complete" : "",
                  isToday ? "today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={day.dateKey}
              >
                <span className="calendar-date-number">{day.dayNumber}</span>
                <span className="calendar-habit-dots" aria-label={formatLifeCalendarLabel(habits)}>
                  <span className={habits?.has("face_wash") ? "habit-dot face active" : "habit-dot face"} />
                  <span className={habits?.has("tooth_brush") ? "habit-dot brush active" : "habit-dot brush"} />
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WeeklyGoalPanel({
  state,
  onSetWeeklyGoal,
  pending,
}: {
  state: GymitionState;
  onSetWeeklyGoal: (input: { workoutTarget: number; cardioTarget: number }) => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(!state.weeklyGoal);
  const [workoutTarget, setWorkoutTarget] = useState(state.weeklyGoal?.workoutTarget ?? 3);
  const [cardioTarget, setCardioTarget] = useState(state.weeklyGoal?.cardioTarget ?? 1);
  const workoutProgress = Math.min(state.weeklyGoalProgress.workoutsCompleted, workoutTarget);
  const cardioProgress = Math.min(state.weeklyGoalProgress.cardioWorkoutsCompleted, cardioTarget);

  function saveGoal() {
    const nextWorkoutTarget = clampInteger(workoutTarget, 1, 14);
    const nextCardioTarget = clampInteger(cardioTarget, 0, 14);
    setWorkoutTarget(nextWorkoutTarget);
    setCardioTarget(nextCardioTarget);
    onSetWeeklyGoal({ workoutTarget: nextWorkoutTarget, cardioTarget: nextCardioTarget });
    setEditing(false);
  }

  return (
    <section className="weekly-goal-panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Weekly goals</p>
          <h2>{state.weeklyGoal ? "Track your training rhythm" : "Set your weekly targets"}</h2>
        </div>
        {state.weeklyGoal && !editing && (
          <button className="ghost-light-action compact-action" type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="weekly-goal-form">
          <label>
            Workouts
            <input
              min="1"
              max="14"
              type="number"
              value={workoutTarget}
              onChange={(event) => setWorkoutTarget(Number(event.target.value))}
            />
          </label>
          <label>
            Cardio sessions
            <input
              min="0"
              max="14"
              type="number"
              value={cardioTarget}
              onChange={(event) => setCardioTarget(Number(event.target.value))}
            />
          </label>
          <button className="primary-action compact-action" type="button" onClick={saveGoal} disabled={pending}>
            Save goals
          </button>
        </div>
      ) : (
        <div className="weekly-goal-progress">
          <GoalMeter label="Workouts" value={workoutProgress} target={workoutTarget} />
          <GoalMeter label="Cardio" value={cardioProgress} target={cardioTarget} />
        </div>
      )}
    </section>
  );
}

function GoalMeter({ label, value, target }: { label: string; value: number; target: number }) {
  const percent = target === 0 ? 100 : Math.round((value / target) * 100);

  return (
    <div className="goal-meter-row">
      <div>
        <strong>{label}</strong>
        <span>{target === 0 ? "Not set" : `${value}/${target}`}</span>
      </div>
      <div className="meter compact">
        <span style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function WorkoutView({
  draftEntry,
  draftEntries,
  exercises,
  lastSummary,
  mode,
  simpleDurationMinutes,
  simpleNotes,
  setDraftEntry,
  setMode,
  setSimpleDurationMinutes,
  setSimpleNotes,
  onAddEntry,
  onRemoveEntry,
  onCompleteWorkout,
}: {
  draftEntry: DraftEntry;
  draftEntries: WorkoutEntry[];
  exercises: Exercise[];
  lastSummary: string | null;
  mode: "detailed" | "simple";
  simpleDurationMinutes: number;
  simpleNotes: string;
  setDraftEntry: React.Dispatch<React.SetStateAction<DraftEntry>>;
  setMode: (mode: "detailed" | "simple") => void;
  setSimpleDurationMinutes: (minutes: number) => void;
  setSimpleNotes: (notes: string) => void;
  onAddEntry: () => void;
  onRemoveEntry: (entryId: string) => void;
  onCompleteWorkout: () => void;
}) {
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const selectedExercise = exercises.find((exercise) => exercise.id === draftEntry.exerciseId) ?? exercises[0];
  const canFinish = mode === "simple" ? simpleDurationMinutes >= 1 : draftEntries.length > 0;

  function submitEntry() {
    onAddEntry();
    setIsAddExerciseOpen(false);
  }

  return (
    <div className="workout-layout">
      <section className="workout-toolbar">
        <div>
          <p className="section-label">Current workout</p>
          <h2>
            {mode === "simple"
              ? `${simpleDurationMinutes || 0} minute session`
              : draftEntries.length === 0
                ? "Ready to start logging"
                : `${draftEntries.length} exercises added`}
          </h2>
        </div>
        <div className="workout-toolbar-actions">
          <div className="mode-switch" role="group" aria-label="Workout logging mode">
            <button
              className={mode === "detailed" ? "active" : ""}
              type="button"
              onClick={() => setMode("detailed")}
            >
              Detailed
            </button>
            <button
              className={mode === "simple" ? "active" : ""}
              type="button"
              onClick={() => setMode("simple")}
            >
              Simple time
            </button>
          </div>
          {mode === "detailed" && (
            <button className="round-add-action" type="button" onClick={() => setIsAddExerciseOpen(true)}>
              <Plus size={20} aria-hidden />
              Add exercise
            </button>
          )}
        </div>
      </section>

      <section className="workout-list-surface">
        {mode === "detailed" ? (
          <>
            <div className="workout-list-head">
              <span>Exercise</span>
              <span>Details</span>
              <span>Rewards</span>
              <span aria-hidden />
            </div>
            <div className="entry-list workout-entry-list">
              {draftEntries.length === 0 ? (
                <button className="empty-workout-row" type="button" onClick={() => setIsAddExerciseOpen(true)}>
                  <Plus size={20} aria-hidden />
                  <strong>Add your first exercise</strong>
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
                      <span>+{entry.coinsEarned} coins / +{entry.xpEarned} XP</span>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Remove ${exercise?.name}`}
                        onClick={() => onRemoveEntry(entry.id)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="simple-workout-panel">
            <div className="simple-workout-icon">
              <Clock3 size={22} aria-hidden />
            </div>
            <label>
              Workout length
              <input
                min="1"
                max="1440"
                type="number"
                value={simpleDurationMinutes}
                onChange={(event) => setSimpleDurationMinutes(Number(event.target.value))}
              />
            </label>
            <label className="simple-notes-field">
              Notes
              <input
                value={simpleNotes}
                onChange={(event) => setSimpleNotes(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
        )}
        {lastSummary && <p className="success-copy">{lastSummary}</p>}
        <div className="workout-footer">
          <span>
            {mode === "simple"
              ? "Simple sessions count as completed workouts."
              : draftEntries.length === 0
                ? "No exercises added yet"
                : "Coins, XP, and quests settle automatically."}
          </span>
          <button
            className="complete-action compact-action"
            type="button"
            onClick={onCompleteWorkout}
            disabled={!canFinish}
          >
            Finish
          </button>
        </div>
      </section>

      {isAddExerciseOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="add-exercise-title">
            <div className="modal-head">
              <div>
                <p className="section-label">Add exercise</p>
                <h2 id="add-exercise-title">Log one training item</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setIsAddExerciseOpen(false)}>
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className="form-grid">
              <label>
                Exercise
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
                  Sets
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
                  Reps
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
                  Weight
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
                  Minutes
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
                Notes
                <input
                  value={draftEntry.notes}
                  onChange={(event) =>
                    setDraftEntry((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="modal-actions">
              <button className="ghost-light-action" type="button" onClick={() => setIsAddExerciseOpen(false)}>
                Cancel
              </button>
              <button className="primary-action" type="button" onClick={submitEntry}>
                <Plus size={18} aria-hidden />
                Add to list
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function HistoryView({ workouts, exercises }: { workouts: WorkoutSession[]; exercises: Exercise[] }) {
  const completedWorkouts = [...workouts].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  return (
    <div className="history-layout">
      <section className="history-list-surface">
        <div className="section-heading">
          <div>
            <p className="section-label">Completed workouts</p>
            <h2>History</h2>
          </div>
        </div>
        <div className="history-list">
          {completedWorkouts.length === 0 ? (
            <p className="empty-copy">Completed workouts will show up here.</p>
          ) : (
            completedWorkouts.map((workout) => {
              const expanded = workout.id === expandedWorkoutId;
              return (
                <article className={expanded ? "history-record expanded" : "history-record"} key={workout.id}>
                  <div className="history-row">
                    <div className="history-row-main">
                      <strong>{workout.completedAt ? formatShortDate(workout.completedAt) : "Draft"}</strong>
                      <span>{formatWorkoutSummary(workout, exercises)}</span>
                    </div>
                    <div className="history-rewards">
                      <span>+{workout.totalCoinsEarned} coins</span>
                      <span>+{workout.totalXpEarned} XP</span>
                    </div>
                    <button
                      className="detail-toggle"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedWorkoutId(expanded ? null : workout.id)}
                    >
                      {expanded ? "Collapse" : "Details"}
                    </button>
                  </div>
                  {expanded && (
                    <div className="inline-history-detail">
                      <div className="detail-summary">
                        <span>{workout.mode === "simple" ? "Simple time log" : `${workout.entries.length} exercises`}</span>
                        <span>+{workout.totalCoinsEarned} coins</span>
                        <span>+{workout.totalXpEarned} XP</span>
                      </div>
                      <div className="detail-entry-list">
                        {workout.mode === "simple" ? (
                          <div className="detail-entry-row">
                            <div className="detail-entry-main">
                              <strong>Session duration</strong>
                              {workout.notes && <span>{workout.notes}</span>}
                            </div>
                            <span className="detail-entry-value">{formatDuration(workout.durationSeconds ?? 0)}</span>
                          </div>
                        ) : (
                          workout.entries.map((entry) => {
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
                          })
                        )}
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
          <p className="section-label">Reward shop</p>
          <h2>Trade coins for training flair</h2>
        </div>
        <strong>{coins} coins</strong>
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
                <strong>{reward.cost} coins</strong>
                <button
                  className="primary-action compact-action"
                  type="button"
                  disabled={owned || coins < reward.cost}
                  onClick={() => onPurchaseReward(reward)}
                >
                  {owned ? "Owned" : "Redeem"}
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
  rewards,
  onSaveProfile,
  onResetProfileData,
  resetPending,
}: {
  state: GymitionState;
  level: number;
  equippedReward?: Reward;
  ownedRewardIds: Set<string>;
  rewards: Reward[];
  onSaveProfile: (username: string) => void;
  onResetProfileData: () => void;
  resetPending: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(state.user.username);
  const ownedRewards = rewards.filter((reward) => ownedRewardIds.has(reward.id));

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

  function confirmReset() {
    onResetProfileData();
    setIsResetConfirmOpen(false);
  }

  return (
    <div className="player-profile">
      <section className="profile-hero">
        <div className="player-avatar">{state.user.username.slice(0, 2).toUpperCase()}</div>
        <div className="player-identity">
          <p className="section-label">Player profile</p>
          {isEditing ? (
            <label className="profile-name-field">
              Display name
              <input
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                autoFocus
              />
            </label>
          ) : (
            <>
              <h2>{state.user.username}</h2>
              <p>{equippedReward?.metadata.title ?? "No title equipped"}</p>
            </>
          )}
        </div>
        <div className="profile-actions">
          {isEditing ? (
            <>
              <button className="ghost-light-action" type="button" onClick={cancelEdit}>
                <X size={16} aria-hidden />
                Cancel
              </button>
              <button className="primary-action compact-action" type="button" onClick={saveEdit}>
                <Save size={16} aria-hidden />
                Save
              </button>
            </>
          ) : (
            <button className="ghost-light-action" type="button" onClick={() => setIsEditing(true)}>
              <Pencil size={16} aria-hidden />
              Edit
            </button>
          )}
          <button className="danger-action compact-action" type="button" onClick={() => setIsResetConfirmOpen(true)}>
            <Trash2 size={16} aria-hidden />
            Reset data
          </button>
        </div>
      </section>

      <section className="profile-progression">
        <div>
          <p className="section-label">Player progress</p>
          <h2>Level {level}</h2>
        </div>
        <div className="profile-level-meter">
          <div className="meter compact">
            <span style={{ width: `${Math.min(100, state.user.xp % 100)}%` }} />
          </div>
          <span>{state.user.xp} XP</span>
        </div>
      </section>

      <section className="profile-stat-lanes" aria-label="Profile stats">
        <div>
          <span>Coins</span>
          <strong>{state.user.coins}</strong>
        </div>
        <div>
          <span>Check-in streak</span>
          <strong>{state.user.currentStreak}</strong>
        </div>
        <div>
          <span>Workouts</span>
          <strong>{state.workouts.length}</strong>
        </div>
        <div>
          <span>Rewards</span>
          <strong>{ownedRewardIds.size}</strong>
        </div>
      </section>

      <section className="profile-inventory">
        <div className="section-heading">
          <div>
            <p className="section-label">Showcase</p>
            <h2>Owned rewards</h2>
          </div>
        </div>
        <div className="inventory-list">
          {ownedRewards.length === 0 ? (
            <p className="empty-copy">No rewards redeemed yet. Complete workouts to earn coins.</p>
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
      {isResetConfirmOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel danger-modal" role="dialog" aria-modal="true" aria-labelledby="reset-data-title">
            <div className="modal-head">
              <div>
                <p className="section-label">Testing reset</p>
                <h2 id="reset-data-title">Reset all app data?</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setIsResetConfirmOpen(false)}>
                <X size={16} aria-hidden />
              </button>
            </div>
            <p className="danger-copy">
              This clears workouts, check-ins, rewards, quests, coins, XP, and streaks for this account. Your profile name stays.
            </p>
            <div className="modal-actions">
              <button className="ghost-light-action" type="button" onClick={() => setIsResetConfirmOpen(false)}>
                Cancel
              </button>
              <button className="danger-action" type="button" onClick={confirmReset} disabled={resetPending}>
                Reset all data
              </button>
            </div>
          </section>
        </div>
      )}
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
    dailyCheckins: [],
    lifeHabitCheckins: [],
    lifeSummary: {
      streak: 0,
      todayCompleted: false,
      todayCompletedCount: 0,
    },
    weeklyGoal: null,
    weeklyGoalProgress: {
      workoutsCompleted: 0,
      cardioWorkoutsCompleted: 0,
    },
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

function applyCompletedWorkoutState(
  current: GymitionState,
  input: {
    id: string;
    mode: "detailed" | "simple";
    entries: WorkoutEntry[];
    durationSeconds?: number;
    notes?: string;
    completedAt: string;
    hasCardio: boolean;
  },
): GymitionState {
  const exerciseCoins = input.entries.reduce((total, entry) => total + entry.coinsEarned, 0);
  const exerciseXp = input.entries.reduce((total, entry) => total + entry.xpEarned, 0);
  const workoutCoins = exerciseCoins + REWARD_RULES.workoutCompleted.coins;
  const workoutXp = exerciseXp + REWARD_RULES.workoutCompleted.xp;
  const workout: WorkoutSession = {
    id: input.id,
    status: "completed",
    mode: input.mode,
    startedAt: input.completedAt,
    completedAt: input.completedAt,
    durationSeconds: input.durationSeconds,
    notes: input.notes,
    entries: input.entries,
    totalCoinsEarned: workoutCoins,
    totalXpEarned: workoutXp,
  };
  const entryCoinLedger = input.entries.map((entry) =>
    createLedgerEntry(entry.coinsEarned, "exercise_logged", "workout_entry", entry.id),
  );
  const entryXpLedger = input.entries.map((entry) =>
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
    weeklyGoalProgress: {
      ...current.weeklyGoalProgress,
      workoutsCompleted: current.weeklyGoalProgress.workoutsCompleted + 1,
      cardioWorkoutsCompleted: current.weeklyGoalProgress.cardioWorkoutsCompleted + (input.hasCardio ? 1 : 0),
    },
    coinLedger: [
      ...current.coinLedger,
      ...entryCoinLedger,
      createLedgerEntry(REWARD_RULES.workoutCompleted.coins, "workout_completed", "workout", input.id),
    ],
    xpLedger: [
      ...current.xpLedger,
      ...entryXpLedger,
      createLedgerEntry(REWARD_RULES.workoutCompleted.xp, "workout_completed", "workout", input.id),
    ],
  };

  return applyAutoQuestRewards(rewardedWorkoutState);
}

function resetAppDataState(current: GymitionState): GymitionState {
  return {
    ...current,
    user: {
      ...current.user,
      coins: 0,
      xp: 0,
      currentStreak: 0,
      lastLoginRewardDate: null,
    },
    coinLedger: [],
    xpLedger: [],
    workouts: [],
    userRewards: [],
    questRewards: {},
    dailyCheckins: [],
    lifeHabitCheckins: [],
    lifeSummary: {
      streak: 0,
      todayCompleted: false,
      todayCompletedCount: 0,
    },
    weeklyGoal: null,
    weeklyGoalProgress: {
      workoutsCompleted: 0,
      cardioWorkoutsCompleted: 0,
    },
  };
}

function usesSets(exercise: Exercise) {
  return exercise.measurementType === "reps_weight" || exercise.measurementType === "reps_only";
}

function usesReps(exercise: Exercise) {
  return exercise.measurementType === "reps_weight" || exercise.measurementType === "reps_only";
}

function getQuoteIndex(date = new Date()) {
  const sampleKey = `${localDateKey(date)}-${date.getHours()}`;
  return [...sampleKey].reduce((total, character) => total + character.charCodeAt(0), 0) % motivationalQuotes.length;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function categoryLabel(category: Exercise["category"]) {
  const labels: Record<Exercise["category"], string> = {
    chest: "Chest",
    back: "Back",
    legs: "Legs",
    shoulders: "Shoulders",
    arms: "Arms",
    core: "Core",
    cardio: "Cardio",
    mobility: "Mobility",
  };

  return labels[category];
}

function formatQuestProgress(quest: Quest, value: number) {
  if (quest.targetType === "duration_seconds") {
    return `${Math.floor(value / 60)}/${Math.floor(quest.targetValue / 60)} min`;
  }

  return `${value}/${quest.targetValue}`;
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const leadingEmptyDays = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const days: Array<{ dateKey: string; dayNumber: number } | null> = [];

  for (let index = 0; index < leadingEmptyDays; index += 1) {
    days.push(null);
  }

  for (let dayNumber = 1; dayNumber <= lastDay.getDate(); dayNumber += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber);
    days.push({
      dateKey: localDateKey(date),
      dayNumber,
    });
  }

  return days;
}

function formatLifeCalendarLabel(habits?: Set<LifeHabitType>) {
  if (isLifeDayComplete(habits)) {
    return "Face washed and teeth brushed";
  }

  if (habits?.has("face_wash")) {
    return "Face washed";
  }

  if (habits?.has("tooth_brush")) {
    return "Teeth brushed";
  }

  return "No check-in yet";
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function formatWorkoutSummary(workout: WorkoutSession, exercises: Exercise[]) {
  if (workout.mode === "simple") {
    return `Simple time log · ${formatDuration(workout.durationSeconds ?? 0)}`;
  }

  const exerciseNames = workout.entries
    .map((entry) => exercises.find((exercise) => exercise.id === entry.exerciseId)?.name)
    .filter(Boolean);

  return exerciseNames.length ? exerciseNames.join(", ") : "Detailed workout";
}

function formatEntry(entry: WorkoutEntry) {
  if (entry.durationSeconds) {
    return `${Math.round(entry.durationSeconds / 60)} min`;
  }
  if (entry.sets && entry.reps && entry.weight !== undefined) {
    return `${entry.sets} sets x ${entry.reps} reps, ${entry.weight} kg`;
  }
  if (entry.sets && entry.reps) {
    return `${entry.sets} sets x ${entry.reps} reps`;
  }
  return "Completed";
}

function ledgerReasonLabel(reason: LedgerReason) {
  const labels: Record<LedgerReason, string> = {
    daily_login: "Daily login",
    workout_completed: "Workout complete",
    exercise_logged: "Exercise logged",
    quest_completed: "Quest complete",
    streak_bonus: "Check-in streak bonus",
    reward_purchase: "Reward redeemed",
    manual_adjustment: "Manual adjustment",
  };

  return labels[reason];
}

function rewardTypeLabel(type: Reward["type"]) {
  const labels: Record<Reward["type"], string> = {
    title: "Title",
    badge: "Badge",
    theme: "Theme",
    avatar_item: "Avatar item",
    custom: "Custom",
  };

  return labels[type];
}
