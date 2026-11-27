[![make.fun](https://make.fun/badge/news-image-20261127.svg)](https://make.fun/bounty/news-image-20261127)
[![Rank](https://make.fun/badge/news-image-20261127/hioraeriska/news-image-20261127/rank.svg)](https://make.fun/bounty/news-image-20261127)
[![Reward](https://make.fun/badge/news-image-20261127/hioraeriska/news-image-20261127/reward.svg)](https://make.fun/bounty/news-image-20261127)
[![Rank](https://make.fun/news-image-20261127/hioraeriska/news-image-20261127/rank.svg)](https://make.fun/bounty/news-image-20261127)
[![Reward](https://make.fun/news-image-20261127/hioraeriska/news-image-20261127/reward.svg)](https://make.fun/bounty/news-image-20261127)

# The World — Friday 27 November 2026

A program that draws one image summing up the world's news of Friday
27 November 2026: a dense tabloid front page with one hero story and
35 more real stories across 7 regions, a drawn scene of the Kuwait
drone strike, a UTC timeline and a date check. Every story was first
reported on 27 November 2026.

## How it works

`main.ts` (Node 22, standard library only) draws the whole front page
in code — a built-in 5x7 bitmap font, vector shapes, and a hand-written
PNG encoder — and writes a deterministic 1024x1024 PNG to
`/output/entry.png`. Two runs write identical bytes. No network at
runtime.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Entry

Built for the [news-image-20261127](https://make.fun/bounty/news-image-20261127)
bounty on make.fun.
