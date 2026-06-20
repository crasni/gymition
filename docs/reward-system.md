# Reward System

## Design Goals

The reward system should stay simple, intuitive, rewarding, and resistant to coin inflation.

## Currencies

- Coins are spendable in the reward shop.
- XP is permanent progression for levels.
- Titles are the main long-term reward sink.

## Current Reward Rules

Defined in `src/features/economy/reward-rules.ts`:

- Daily check-in: 10 coins, 10 XP
- Workout complete: 35 coins, 45 XP
- Detailed exercise logged: 2 coins, 8 XP

Check-in streak bonus is capped:

- 3+ days: +5 coins
- 7+ days: +10 coins
- 14+ days: +15 coins
- 30+ days: +20 coins cap

## Daily Quests

Defined in `src/features/quests/quest-rules.ts`.

Daily quests give modest coins and stronger XP rewards. This keeps daily play rewarding without making coins inflate too quickly.

## Shop

Defined in `src/features/rewards/reward-service.ts`.

The shop is currently title-focused:

- First Rep: 120 coins
- Steady Pace: 260 coins
- Session Finisher: 520 coins
- Volume Builder: 900 coins
- Streak Keeper: 1500 coins
- Cardio Spark: 2200 coins
- Life in Order: 3200 coins
- Quiet Machine: 5000 coins

## Future Reward Ideas

Keep future additions simple:

- More title ladders
- Cosmetic profile frames
- Streak celebration styles
- Weekly bonus claims with one claim record per week
- Achievement badges that are earned, not bought

Avoid adding too many recurring coin payouts without adding long-term coin sinks.
