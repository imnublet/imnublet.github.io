# Learn

Static course pages, no build step.

```
learn/
  index.html              course catalogue
  learn.css / learn.js    shared styles + runtime (KaTeX, highlight.js, demos)
  probability/index.html  C01 syllabus (Yates & Goodman)
  signal-processing/      C02 syllabus (Vetterli, Kovačević & Goyal)
  _template/lesson.html   lesson template, filled with a worked example
```

## Adding a lesson

1. Copy `_template/lesson.html` to `<course>/<slug>.html`. It sits at the same depth, so relative paths keep working.
2. Replace each `[SLOT]` block. The header comment lists every component.
3. In the course's `index.html`, turn the lesson's `<div class="lesson-row">` into
   `<a class="lesson-row" href="<slug>.html">` and change `soon` to `read →`.
4. Update the `.pager` links on the neighbouring lessons.

Maths: `$…$`, `$$…$$`, `\(…\)`, `\[…\]`; `\tag{n}` numbers equations. Shared macros
(`\E \Var \Cov \P \R \N \ind \iid \T \d`) live in `learn.js`.

Worked examples: each lesson has two or three `<div class="worked">` blocks placed at the end of the
section they illustrate, numbered `<lesson>.<k>` (e.g. 1.2.1) with `id="example-1-2-1"`. Each has a
`.head`, then `.part` blocks tagged Problem, Approach, Solution (an `ol.steps` whose items open with a
bold step name) and Result (`.part.result`). Examples are original, not taken from the textbook.

Demos: add `<figure class="demo" data-demo="name">` with a `<canvas>`, then register
`Learn.demo("name", (fig, { scope, rng, randn, colors }) => { …; return redraw; })`
in a `<script>` after `learn.js`. `scope.axes`, `scope.trace`, `scope.band` and
`scope.label` draw in the site's oscilloscope style.
