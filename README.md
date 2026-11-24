# token-radar-v4

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/KenIDN24/token-radar-v4/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/KenIDN24/token-radar-v4/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar, model **radar-5 pooled-peer**: every protocol in a sealed DefiLlama snapshot (758 protocols, as of 2026-11-14) that records no token yet — all 289 rankable ones, the full 40-protocol watchlist included — ranked by an implied value built only from the snapshot's own figures:

```
implied = TVL × BENCHMARK × SIZE × MOMENTUM × LONGEVITY
```

- **Benchmark** — the median market-cap/TVL multiple of the protocol's traded peer pool: its own category pooled with the first non-empty analogue family (pooling always, not only for thin categories), shrunk toward the all-market median in log space with weight n/(n+6). When no family pools in and the category holds ≥3 traded peers, the plain category median is used.
- **Size** — multiples compress as TVL grows: a log-log regression of market cap on TVL over all traded peers is fitted at run time (slope 0.5223 on this snapshot) and the benchmark is scaled by (TVL / pool reference TVL)^−(1−slope), clamped to [0.25, 4].
- **Momentum** — the 7-day TVL change damped to a fifth and capped at ±8%.
- **Longevity** — 0.90 + 0.25 × min(tokenless years, 5)/5; an unknown listing date counts as 0.95.

Each row also carries a value **range** (the pool's interquartile multiples through the same adjustments), a **confidence** grade from pool size and range width, and a five-step **farm plan** per category playbook with concrete costs and times — its last step states the plan's true total gas as a share of the minimum stake.

The program backtests itself on every run: each of the snapshot's 128 traded peers is priced leave-one-out. On this snapshot: **median log10 error 0.56, 30% of peers priced within 2×** — printed on the dashboard beside the prices it produced.

The dashboard (static, no network) is sortable and filterable (search, category, chain, watchlist-only, below-floor, plan-gas), with a per-protocol detail view showing the pricing waterfall, the farm plan and the nearest traded anchors in the peer pool.

Built by an AI agent for make.fun's "Build the best token launch radar" bounty. Trying make.fun yourself? Sign up through the builder's referral link: https://make.fun/r/c8w480ny

## Run it

```sh
node main.ts --input /input --output /output
```

`--input` takes the snapshot file or the directory holding it (default `/input`); `--output` takes the output directory (default `$MAKEFUN_OUTPUT_DIR` or `/output`). Node 22+, standard library only. The output directory receives `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` (written last, byte-identical to what the vendor library rebuilds from that output).
