# Americano App

Match scheduler and score keeper for Padel Americano tournaments. Plain HTML/CSS/JS with no build step and no dependencies.

## Run

Open `index.html` in a browser. All data is saved in the browser's `localStorage`, so a page reload keeps the tournament.
**Clear saved data** at the bottom of the standings deletes the saved tournament after a confirmation and returns to the setup page.

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
  - **End tournament** is shown under every completed round, so the tournament can be stopped at any time.
    Games without a score are left out of the results.
  - After the final, **End tournament** shows the results: podium, final standings and every played game with its pairs and score.
    It also offers Print and Back to scoring.
- The final round is built from the standings. Its pairing order is chosen in the setup (**Final round**):
  - **1 & 4 vs 2 & 3** (default): 1 + 4 vs 2 + 3, 5 + 8 vs 6 + 7, and so on.
  - **1 & 3 vs 2 & 4**: 1 + 3 vs 2 + 4, 5 + 7 vs 6 + 8, and so on.

  The order can be changed under **Edit names** until **Start final round** is pressed; after that it is locked.
  The final's players are fixed once the first final score is entered.
- Enter the score for either pair; the other pair gets `points − score`. Anything that isn't a whole number from 0 to `points` is rejected.
- Pairings with score entry on the left, live standings on the right (points, matches, W-D-L, +/-).
  Ties in the standings are broken by wins, then point difference.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `padel.png` | Icon for the browser tab and the home-screen shortcut |
| `styles.css` | Styling (light and dark mode) |
| `schedules.js` | Pre-computed, verified whist-tournament schedules plus court balancing |
| `app.js` | Setup, scoring, standings, final round, persistence |
| `americano.robot` | Robot Framework UI tests (SeleniumLibrary) |

## Robot Framework tests

`americano.robot` plays a full tournament in Chrome for 4, 8, 12 and 16 players, each with and without the final round (8 tests).
Two more tests pick the number of players at random and play 3 extra rounds ("Continue playing") after the schedule, one with and one without the final (12 tests in total, see below).
The randomly selected player count is shown as the test's documentation in the log and report.
By default the tests use the app's default player names (Player 1 … Player N).
With the optional template argument `names=${TRUE}` a test shuffles the `@{FINNISH_NAMES}` list, enters the first N names and checks that the tournament uses exactly those names.
Two tests do this: `Americano 8 Players Finnish Names With Final` and `Americano Random Players Finnish Names 3 Extra Rounds`.
Each test:

- enters random scores for one pair per match and checks that the app fills in the other pair's score
- checks the standings totals and saves a screenshot
- reads every played game from the results table
- verifies that no two players partner each other twice and that every player meets every other player exactly twice as an opponent (scheduled rounds only)
- in the extra-round tests, verifies that each extra round repeats the pairings of the matching scheduled round

### Requirements

- Python 3.8+ with Robot Framework and SeleniumLibrary:

  ```
  pip install robotframework robotframework-seleniumlibrary
  ```

- Google Chrome. SeleniumLibrary 6+ downloads a matching ChromeDriver automatically through Selenium Manager.
  A `chromedriver` on `PATH` also works.

### Run

From the project folder:

```
python -m robot --outputdir results americano.robot
```

Run a single test, or select the browser:

```
python -m robot --outputdir results --test "Americano 8 Players With Final" americano.robot
python -m robot --outputdir results --variable BROWSER:firefox americano.robot
```

Open `results/log.html` to see the logged match rows, standings, games table and screenshots.
`results/report.html` has the pass/fail summary.
