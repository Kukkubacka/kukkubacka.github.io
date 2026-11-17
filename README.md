# Padel Americano

Match scheduler and score keeper for Padel Americano tournaments. Plain HTML/CSS/JS with no build step and no dependencies.

## Run

Open `index.html` in a browser. All data is saved in the browser's `localStorage`, so a page reload keeps the tournament.

## Features

- 4, 8, 12 or 16 players (1–4 courts). Players and courts can be named and renamed during play.
- Points per match are configurable. Defaults: 4 → 32, 8 → 32, 12 → 20, 16 → 16.
- `n − 1` regular rounds. Every player partners every other player **exactly once** and plays against every other player **exactly twice**.
- Courts are assigned so that each player spreads their matches over the courts as evenly as the schedule allows.
- Buttons appear under a round as soon as all of its scores are valid:
  - **Next round** moves to the following round.
  - After the last scheduled round you can choose **Continue playing** or **Start final round**.
    Continuing adds extra rounds that repeat the schedule from round 1.
  - Every extra round has **Start final round**, enabled once that round is complete, and **Next extra round**.
  - After the final, **End tournament** shows the results: podium, final standings and every played game with its pairs and score.
    It also offers Print and Back to scoring.
- The final round is built from the standings: 1 + 4 vs 2 + 3, 5 + 8 vs 6 + 7, and so on. Its pairings are fixed once the first final score is entered.
- Enter the score for either pair; the other pair gets `points − score`. Anything that isn't a whole number from 0 to `points` is rejected.
- Pairings with score entry on the left, live standings on the right (points, matches, W-D-L, +/-).
  Ties in the standings are broken by wins, then point difference.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Styling (light and dark mode) |
| `schedules.js` | Pre-computed, verified whist-tournament schedules plus court balancing |
| `app.js` | Setup, scoring, standings, final round, persistence |
