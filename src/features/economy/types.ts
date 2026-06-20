export type MeasurementType =
  | "reps_weight"
  | "reps_only"
  | "duration"
  | "distance"
  | "completion";

export type ExerciseCategory =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "cardio"
  | "mobility";

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  measurementType: MeasurementType;
  defaultCoinValue: number;
  isActive: boolean;
};

export type LedgerReason =
  | "daily_login"
  | "workout_completed"
  | "exercise_logged"
  | "quest_completed"
  | "streak_bonus"
  | "reward_purchase"
  | "manual_adjustment";

export type LedgerEntry = {
  id: string;
  amount: number;
  reason: LedgerReason;
  sourceType: "login" | "workout" | "workout_entry" | "quest" | "reward" | "manual";
  sourceId: string;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  coins: number;
  xp: number;
  currentStreak: number;
  lastLoginRewardDate: string | null;
  createdAt: string;
};

export type Reward = {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: "title" | "badge" | "theme" | "avatar_item" | "custom";
  metadata: Record<string, string>;
  isActive: boolean;
};

export type UserReward = {
  rewardId: string;
  purchasedAt: string;
  equippedAt: string | null;
};

export type WorkoutEntry = {
  id: string;
  exerciseId: string;
  sets?: number;
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  notes?: string;
  coinsEarned: number;
  xpEarned: number;
};

export type WorkoutSession = {
  id: string;
  status: "draft" | "completed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  entries: WorkoutEntry[];
  totalCoinsEarned: number;
  totalXpEarned: number;
};

export type QuestTargetType =
  | "workout_completed"
  | "exercise_count"
  | "category_logged"
  | "duration_seconds";

export type Quest = {
  id: string;
  code: string;
  name: string;
  description: string;
  period: "daily" | "weekly";
  targetType: QuestTargetType;
  targetValue: number;
  category?: ExerciseCategory;
  coinReward: number;
  xpReward: number;
  isActive: boolean;
};

export type QuestProgress = {
  questId: string;
  progress: number;
  completed: boolean;
  rewarded: boolean;
};

export type DailyCheckin = {
  id: string;
  checkinDate: string;
  streakDay: number;
  coinsEarned: number;
  xpEarned: number;
  streakBonusCoins: number;
  createdAt: string;
};

export type WeeklyGoal = {
  id: string;
  weekStart: string;
  workoutTarget: number;
  cardioTarget: number;
};

export type WeeklyGoalProgress = {
  workoutsCompleted: number;
  cardioWorkoutsCompleted: number;
};

export type GymitionState = {
  user: UserProfile;
  coinLedger: LedgerEntry[];
  xpLedger: LedgerEntry[];
  workouts: WorkoutSession[];
  userRewards: UserReward[];
  questRewards: Record<string, string>;
  dailyCheckins: DailyCheckin[];
  weeklyGoal: WeeklyGoal | null;
  weeklyGoalProgress: WeeklyGoalProgress;
};
