# Padel App

Match scheduler and score keeper for Padel Americano and Mexicano tournaments. Plain HTML/CSS/JS with no build step and no dependencies.

## Run

Open `index.html` in a browser. All data is saved in the browser's `localStorage`, so a page reload keeps the tournament.
**Clear saved data** at the bottom of the standings deletes the saved tournament after a confirmation and returns to the setup page.

## Features

- The setup page asks for a **tournament name** (optional) and the **playing mode**:
  - **Americano** (default): a fixed schedule, described below.
  - **Mexicano**: every round is paired from the current standings, in groups of four, using the **Pair selection**.
    Round 1 follows the player order (shuffled when *Shuffle players randomly* is on).
    Each round's pairs are fixed once its first score is entered.
    A Mexicano tournament has red backgrounds instead of green.

  The name and mode are shown in the header and the name in the browser tab.
  The name can be changed under **Edit names**; the mode cannot be changed after the tournament has started.
- 4, 8, 12 or 16 players (1–4 courts). Players and courts can be named and renamed during play.
- Points per match are configurable. Defaults: 4 → 32, 8 → 32, 12 → 20, 16 → 16.
- `n − 1` regular rounds. In Americano every player partners every other player **exactly once** and plays against every other player **exactly twice**.
- Courts are assigned so that each player spreads their matches over the courts as evenly as the schedule allows.
- Buttons appear under a round as soon as all of its scores are valid:
  - **Next round** moves to the next unplayed round.
  - When every round has been played you can choose **Continue playing** or **Start final round**.
    Rounds can be played in any order (pick a round from the round buttons); these buttons appear under whichever round is completed last.
    Once a round's first score is entered, that round must be completed before scores can be entered in any other round
    (the other rounds show a notice with a link back to it; clearing the round's scores unlocks them again).
    Continuing adds extra rounds; in Americano they repeat the schedule from round 1.
  - Every extra round has **Start final round**, enabled once that round is complete, and **Next extra round**.
  - **End tournament** is shown under every completed round, so the tournament can be stopped at any time.
    Games without a score are left out of the results.
  - After the final, **End tournament** shows the results: podium, final standings and every played game with its pairs and score.
  - **Back to scoring** on the results page lets scores be corrected; the button is then called **Save** and returns to the results.
    Continuing play (a new round or the final) makes it **End tournament** again.
    It also offers Print and Back to scoring.
- The final round is built from the standings. The **Pair selection** in the setup sets how each group of four is paired
  (in Americano for the final round, in Mexicano for every round):
  - **1 & 4 vs 2 & 3** (default): 1 + 4 vs 2 + 3, 5 + 8 vs 6 + 7, and so on.
  - **1 & 3 vs 2 & 4**: 1 + 3 vs 2 + 4, 5 + 7 vs 6 + 8, and so on.

  It can be changed under **Edit names** until **Start final round** is pressed (Americano) or until the first score is entered (Mexicano).
  The final's players are fixed once the first final score is entered.
- Enter the score for either pair; the other pair gets `points − score`. Anything that isn't a whole number from 0 to `points` is rejected.
  Clicking or tapping a score field opens a score picker with a button for every score from 0 to `points` (each button also shows the other pair's score); **Clear score** empties the match, Esc or **Cancel** closes it. A keyboard can still type the score directly.
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
Two more tests pick the number of players at random and play 3 extra rounds ("Continue playing") after the schedule, one with and one without the final. Further tests cover Finnish names, the pair selection, the tournament name and Mexicano (see below).
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
- checks that the final round is paired from the standings with the chosen pair selection, and that the pair selection is locked under **Edit names** once the final has started

Two Americano tests use the optional arguments `pairing=13-24` (final 1 & 3 vs 2 & 4; the default is `14-23`) and `tournament=<name>` (checks the name in the header and the browser tab title).

### Mexicano tests

Six `Mexicano …` tests use the `Play Mexicano Tournament` template (same arguments: 4–16 or RANDOM players, final, extra rounds, `names`, `pairing`, `tournament`). Each test:

- selects Mexicano and checks the mode badge and the red Mexicano theme
- before the first score of every round, checks that court k plays standings places 4k+1 … 4k+4 with the chosen pair selection
- checks that the pair selection is open until the first score and locked after it, and that the playing mode is always locked under **Edit names**
- checks the standings totals, that every player plays exactly once per round, and that the played games list every round

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
python -m robot --outputdir results --test "Mexicano*" americano.robot
python -m robot --outputdir results --variable BROWSER:firefox americano.robot
```

Open `results/log.html` to see the logged match rows, standings, games table and screenshots.
`results/report.html` has the pass/fail summary.
