# Development roadmap

## Goal
A spectator-only baseball simulation. Each click creates two new teams and their players; the viewer watches one complete game. Completed box scores are saved locally, but the players do not persist into future games.

## Categories
- **High school** (current prototype): regional/national tournaments and exhibitions; generated school names, 20 players per team, 9-inning games, competition-specific tactical AI.
- **University** (future): university conferences, 18–22-year-old player cohorts, high-school background, university records.
- **Corporate / amateur adult** (future): company teams, city tournaments, university/high-school histories, veteran players.
- **Professional** (future): fictional clubs, player histories and career stats, deeper pitching staffs and tactical decisions.

## Shared architecture target
- `engine/`: pitch, plate appearance, baserunners, outs, inning transitions, box score. No category-specific modifiers inside the inning rules.
- `generation/`: context, team and player factories selected by category.
- `rules/`: tournament-specific DH, mercy, extra-innings, tie and roster rules.
- `strategy/`: decisions for batting, squeeze, sacrifice, steal and pitching changes, based on competition stakes, score, inning and player skills.
- `ui/`: animated ballpark, spectator controls, scorecards and local match history.

The current implementation is a single HTML file. These modules describe the future refactor, not modules that already exist.

## Test coverage
`node tests/smoke.cjs` runs 1,000 simulated games without rendering and asserts:
- Every game finishes;
- Legal ball/strike/out states;
- No duplicate baserunner IDs;
- No tied finished games;
- Box-score total runs and hits match per-player totals.

**Coverage limitations:** the smoke test does not prove RBI, earned runs, sacrifice/fielder's choice accuracy, real-browser animation, or realistic statistical balance. Those require separate tests.

## Near-term priorities
1. Check GitHub Actions smoke test on every change.
2. Add property-based checks for inning transitions, force-outs, tagging, and pitcher outs.
3. Investigate remaining scoring edge cases (especially runner-scoring on final outs, sacrifice flies, and interference).
4. Improve game-dependent strategy through controlled game-state tests and event logs.
5. Split engine from UI while preserving current GitHub Pages URL.
