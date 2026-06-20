import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const exerciseCategoryEnum = pgEnum("exercise_category", [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
  "cardio",
  "mobility",
]);

export const measurementTypeEnum = pgEnum("measurement_type", [
  "reps_weight",
  "reps_only",
  "duration",
  "distance",
  "completion",
]);

export const workoutStatusEnum = pgEnum("workout_status", ["draft", "completed", "cancelled"]);
export const workoutModeEnum = pgEnum("workout_mode", ["detailed", "simple"]);

export const ledgerReasonEnum = pgEnum("ledger_reason", [
  "daily_login",
  "workout_completed",
  "exercise_logged",
  "quest_completed",
  "streak_bonus",
  "reward_purchase",
  "manual_adjustment",
]);

export const ledgerSourceTypeEnum = pgEnum("ledger_source_type", [
  "login",
  "workout",
  "workout_entry",
  "quest",
  "reward",
  "manual",
]);

export const questPeriodEnum = pgEnum("quest_period", ["daily", "weekly"]);

export const questTargetTypeEnum = pgEnum("quest_target_type", [
  "workout_completed",
  "exercise_count",
  "category_logged",
  "duration_seconds",
]);

export const rewardTypeEnum = pgEnum("reward_type", ["title", "badge", "theme", "avatar_item", "custom"]);

export const lifeHabitTypeEnum = pgEnum("life_habit_type", ["face_wash", "tooth_brush"]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    coins: integer("coins").notNull().default(0),
    xp: integer("xp").notNull().default(0),
    currentStreak: integer("current_streak").notNull().default(0),
    lastLoginRewardDate: date("last_login_reward_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const dailyCheckins = pgTable(
  "daily_checkins",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkinDate: date("checkin_date").notNull(),
    streakDay: integer("streak_day").notNull(),
    coinsEarned: integer("coins_earned").notNull().default(0),
    xpEarned: integer("xp_earned").notNull().default(0),
    streakBonusCoins: integer("streak_bonus_coins").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("daily_checkins_user_date_unique").on(table.userId, table.checkinDate),
    index("daily_checkins_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const lifeHabitCheckins = pgTable(
  "life_habit_checkins",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkinDate: date("checkin_date").notNull(),
    habitType: lifeHabitTypeEnum("habit_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("life_habit_checkins_user_date_type_unique").on(
      table.userId,
      table.checkinDate,
      table.habitType,
    ),
    index("life_habit_checkins_user_date_idx").on(table.userId, table.checkinDate),
  ],
);

export const exercises = pgTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: exerciseCategoryEnum("category").notNull(),
  measurementType: measurementTypeEnum("measurement_type").notNull(),
  defaultCoinValue: integer("default_coin_value").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workoutSessions = pgTable(
  "workout_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: workoutStatusEnum("status").notNull().default("draft"),
    mode: workoutModeEnum("mode").notNull().default("detailed"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    notes: text("notes"),
    totalCoinsEarned: integer("total_coins_earned").notNull().default(0),
    totalXpEarned: integer("total_xp_earned").notNull().default(0),
  },
  (table) => [index("workout_sessions_user_completed_idx").on(table.userId, table.completedAt)],
);

export const workoutEntries = pgTable(
  "workout_entries",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    sets: integer("sets"),
    reps: integer("reps"),
    weight: integer("weight"),
    durationSeconds: integer("duration_seconds"),
    distanceMeters: integer("distance_meters"),
    notes: text("notes"),
    coinsEarned: integer("coins_earned").notNull().default(0),
    xpEarned: integer("xp_earned").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("workout_entries_session_idx").on(table.sessionId)],
);

export const coinLedgerEntries = pgTable(
  "coin_ledger_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: ledgerReasonEnum("reason").notNull(),
    sourceType: ledgerSourceTypeEnum("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("coin_ledger_user_created_idx").on(table.userId, table.createdAt)],
);

export const xpLedgerEntries = pgTable(
  "xp_ledger_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: ledgerReasonEnum("reason").notNull(),
    sourceType: ledgerSourceTypeEnum("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("xp_ledger_user_created_idx").on(table.userId, table.createdAt)],
);

export const quests = pgTable(
  "quests",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    period: questPeriodEnum("period").notNull(),
    targetType: questTargetTypeEnum("target_type").notNull(),
    targetValue: integer("target_value").notNull(),
    category: exerciseCategoryEnum("category"),
    coinReward: integer("coin_reward").notNull().default(0),
    xpReward: integer("xp_reward").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("quests_code_unique").on(table.code)],
);

export const userQuests = pgTable(
  "user_quests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questId: text("quest_id")
      .notNull()
      .references(() => quests.id),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    progress: integer("progress").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => [
    index("user_quests_user_period_idx").on(table.userId, table.periodStart),
    uniqueIndex("user_quests_unique_period").on(table.userId, table.questId, table.periodStart),
  ],
);

export const userWeeklyGoals = pgTable(
  "user_weekly_goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    workoutTarget: integer("workout_target").notNull(),
    cardioTarget: integer("cardio_target").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_weekly_goals_user_week_unique").on(table.userId, table.weekStart),
    index("user_weekly_goals_user_idx").on(table.userId),
  ],
);

export const rewards = pgTable("rewards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  cost: integer("cost").notNull(),
  type: rewardTypeEnum("type").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRewards = pgTable(
  "user_rewards",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rewardId: text("reward_id")
      .notNull()
      .references(() => rewards.id),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
    equippedAt: timestamp("equipped_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.rewardId] }),
    index("user_rewards_user_idx").on(table.userId),
  ],
);
