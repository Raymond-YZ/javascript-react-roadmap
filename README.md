# JS + React Learning Roadmap

A local, dependency-free web app for working through the JavaScript and
React curriculum: 13 modules (7 JavaScript, 6 React), 51 lessons, 53
exercises. Progress is saved in your browser — close the app and reopen
it, everything is still there.

## Run it

```bash
python3 run.py
```

Opens at **http://127.0.0.1:8765/**. The port is fixed on purpose: the
browser ties saved data to the address, so a stable port means your
progress is always found in the same place.

No build step, no dependencies — just `index.html` + `styles.css` +
`app.js`, with the curriculum in `curriculum/`.

## Layout

- **Roadmap** — modules for the active track, with per-module progress.
  Switch tracks with the JavaScript / React tabs in the left rail.
- **Module pages** — lessons and exercises per module, plus an
  "I already know this" toggle that marks a whole module complete
  (and toggles back off).
- **Practice** — every exercise, grouped by track and module.
- **Progress** — per-track bars, a module checklist, and JSON
  Export / Import backup of your progress.

## Notes

- `design/` holds the approved UI mockups and is gitignored — mockups
  never get committed.
- Curriculum content lives in `curriculum/index.json` +
  `curriculum/modules/*.json` and is fetched at runtime.
