// Central metadata for listings. Post bodies live in src/pages/blog/*.astro.

export const posts = [
  {
    slug: 'how-i-stopped-fooling-myself-with-backtests',
    title: 'How I Stopped Fooling Myself With Backtests',
    deck: 'Two statistical gates — the Deflated Sharpe Ratio and the Probability of Backtest Overfitting — decide whether an alpha ever touches real money.',
    date: '2026-07-18',
    readtime: '7 min',
    project: 'Alpha Engine',
    tags: ['quant', 'overfitting', 'statistics'],
  },
  {
    slug: 'shipping-a-fatigue-model-to-a-wrist-computer',
    title: 'Shipping a Fatigue Model to a Wrist Computer',
    deck: 'Your watch already knows you are cooked. Turning HR/HRV into an on-device Core ML fatigue score — with a retrieval layer for the coaching.',
    date: '2026-07-18',
    readtime: '8 min',
    project: 'RunningFatigueAI',
    tags: ['on-device-ml', 'core-ml', 'healthkit', 'rag'],
  },
  {
    slug: 'reverse-engineering-a-minimap',
    title: "Reverse-Engineering a Video Game's Minimap Into Football Analytics",
    deck: 'A football game gives you a 2-D radar and no data. Computer vision — no deep learning — turns those coloured dots into pitch-metre trajectories.',
    date: '2026-07-18',
    readtime: '7 min',
    project: 'PitchVision',
    tags: ['computer-vision', 'geometry', 'tracking'],
  },
  {
    slug: 'measuring-compositional-language',
    title: 'How Do You Measure Whether a Language Is Compositional?',
    deck: 'When two neural agents invent a language to solve a game, is it compositional or a lookup table? Three metrics — topsim, posdis, bosdis — try to answer.',
    date: '2026-07-18',
    readtime: '8 min',
    project: 'Growing Meaning Spaces',
    tags: ['emergent-communication', 'compositionality', 'information-theory'],
  },
];

export const projects = [
  {
    name: 'Oil & Commodity Alpha Engine',
    state: 'polished',
    kicker: 'Quant / applied ML',
    blurb:
      'A full research-to-execution stack for leveraged commodity CFDs: five alpha families, walk-forward + combinatorial purged CV with deflated Sharpe, block-bootstrap Monte-Carlo risk, and a four-mode execution engine.',
    tags: 'python · vectorbt · finbert · streamlit',
    writeup: '/blog/how-i-stopped-fooling-myself-with-backtests/',
    wide: true,
  },
  {
    name: 'RunningFatigueAI',
    state: 'working MVP',
    kicker: 'On-device ML / watchOS',
    blurb:
      'An Apple-Watch running coach: a Core ML fatigue model over live HealthKit HR/HRV, plus a Sentence-Transformers retrieval layer that grounds its advice in training science.',
    tags: 'swiftui · core ml · healthkit · rag',
    writeup: '/blog/shipping-a-fatigue-model-to-a-wrist-computer/',
  },
  {
    name: 'PitchVision',
    state: 'polished',
    kicker: 'Computer vision',
    blurb:
      'An offline analyzer that screen-scrapes a football game’s 2-D radar, tracks all 22 players by colour, maps radar pixels to pitch metres, and renders team-shape metrics.',
    tags: 'python · opencv · homography · polars',
    writeup: '/blog/reverse-engineering-a-minimap/',
  },
  {
    name: 'PathScape',
    state: 'near-polished',
    kicker: 'Games / plugins',
    blurb:
      'A RuneLite plugin that reads live account state and scores a 485-node progression DAG to recommend your highest-impact next action, weighted by goal profile.',
    tags: 'java · gradle · python · dag',
    writeup: null,
    repo: 'https://github.com/imnublet/Pathscape',
  },
  {
    name: 'Growing Meaning Spaces',
    state: 'research',
    kicker: 'Research / emergent communication',
    blurb:
      'BSc thesis on emergent language: do neural agents invent a compositional protocol as their meaning space grows? Measured with topographic similarity and disentanglement metrics.',
    tags: 'pytorch · egg · information theory',
    writeup: '/blog/measuring-compositional-language/',
  },
];
