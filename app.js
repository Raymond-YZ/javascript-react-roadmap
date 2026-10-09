'use strict';
/*
 * JS + React Learning Roadmap — app logic. No dependencies.
 * Static shell: index.html + styles.css + this file. Curriculum JSON is
 * fetched at runtime. Progress (lessons, exercises, active track) lives in
 * localStorage under a fixed key, so closing and reopening the app — served
 * from the same origin by run.py on its fixed port — keeps everything.
 */

const INDEX_URL = 'curriculum/index.json';
const STORAGE_KEY = 'jsreact.progress.v1';
const ROADMAP_SEEN_KEY = 'jsreact.roadmap.seen';

const TRACKS = {
  javascript: { name: 'JavaScript', color: 'var(--js)' },
  react: { name: 'React', color: 'var(--react)' },
};

const moduleUrl = (id) => 'curriculum/modules/' + id + '.json';

function trackIcon(track) {
  if (track === 'react') {
    return '<svg viewBox="0 0 32 32" fill="none" stroke="#61DAFB" stroke-width="1.7" aria-hidden="true">' +
      '<circle cx="16" cy="16" r="2.2" fill="#61DAFB" stroke="none"/>' +
      '<ellipse cx="16" cy="16" rx="13" ry="5.2"/>' +
      '<ellipse cx="16" cy="16" rx="13" ry="5.2" transform="rotate(60 16 16)"/>' +
      '<ellipse cx="16" cy="16" rx="13" ry="5.2" transform="rotate(120 16 16)"/></svg>';
  }
  return '<svg viewBox="0 0 32 32" aria-hidden="true">' +
    '<polygon points="16,2.5 28.5,9.7 28.5,22.8 16,30 3.5,22.8 3.5,9.7" fill="#FFD43B"/>' +
    '<text x="16" y="21.5" text-anchor="middle" font-size="12.5" font-weight="800" fill="#231a00" font-family="Inter,system-ui,sans-serif">JS</text></svg>';
}

const state = {
  curriculum: null, // { version, modules: [...] } — light index entries until a module is opened
  moduleCache: {}, // id -> full module object
  progress: { lessons: {}, exercises: {}, ui: { track: 'javascript' }, updatedAt: null },
  loadError: null,
  justCompletedModule: null, // transient: checkmark pop on the next render
  switchFlash: false, // transient: fade/slide the view on track switch
};

// Full module objects replace their light index entries once loaded,
// so moduleStats() and friends work on either form.
async function ensureModule(id) {
  if (state.moduleCache[id]) return state.moduleCache[id];
  const r = await fetch(moduleUrl(id));
  if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + moduleUrl(id));
  const mod = await r.json();
  state.moduleCache[id] = mod;
  const i = state.curriculum.modules.findIndex((m) => m.id === id);
  if (i >= 0) {
    // Full module JSON omits `track`; keep the index entry's value so
    // trackModules() doesn't lose the module after it's been opened.
    mod.track = state.curriculum.modules[i].track;
    state.curriculum.modules[i] = mod;
  }
  return mod;
}

function activeTrack() {
  const t = state.progress.ui && state.progress.ui.track;
  return TRACKS[t] ? t : 'javascript';
}

function trackModules(track) {
  return state.curriculum.modules.filter((m) => m.track === track);
}

/* ---------------- progress store ---------------- */

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state.progress = {
        lessons: p && p.lessons ? p.lessons : {},
        exercises: p && p.exercises ? p.exercises : {},
        ui: p && p.ui && TRACKS[p.ui.track] ? { track: p.ui.track } : { track: 'javascript' },
        updatedAt: (p && p.updatedAt) || null,
      };
    }
  } catch (e) {
    state.progress = { lessons: {}, exercises: {}, ui: { track: 'javascript' }, updatedAt: null };
  }
}

function saveProgress() {
  state.progress.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  } catch (e) {
    /* storage unavailable — progress just won't persist */
  }
}

function resetProgress() {
  const track = activeTrack();
  state.progress = { lessons: {}, exercises: {}, ui: { track }, updatedAt: null };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function setTrack(t) {
  if (!TRACKS[t] || t === activeTrack()) return false;
  state.progress.ui.track = t;
  saveProgress();
  return true;
}

const lessonDone = (id) => !!state.progress.lessons[id];
const exerciseDone = (id) => !!state.progress.exercises[id];

/* ---------------- curriculum helpers ---------------- */

function allLessons() {
  const out = [];
  for (const mod of state.curriculum.modules)
    for (const l of mod.lessons) out.push({ module: mod, lesson: l });
  return out;
}

function allExercises() {
  const out = [];
  for (const mod of state.curriculum.modules)
    for (const ex of mod.exercises) out.push({ module: mod, exercise: ex });
  return out;
}

function findModule(id) {
  return state.curriculum.modules.find((m) => m.id === id) || null;
}

function moduleOfLesson(lessonId) {
  for (const m of state.curriculum.modules)
    if (m.lessons.some((l) => l.id === lessonId)) return m.id;
  return null;
}

function moduleOfExercise(exerciseId) {
  for (const m of state.curriculum.modules)
    if (m.exercises.some((e) => e.id === exerciseId)) return m.id;
  return null;
}

function moduleStats(mod) {
  const lt = mod.lessons.length, et = mod.exercises.length;
  const ld = mod.lessons.filter((l) => lessonDone(l.id)).length;
  const ed = mod.exercises.filter((e) => exerciseDone(e.id)).length;
  return { total: lt + et, done: ld + ed, lessonsTotal: lt, lessonsDone: ld, exTotal: et, exDone: ed };
}

function trackStats(track) {
  let total = 0, done = 0, lt = 0, ld = 0, et = 0, ed = 0, mins = 0;
  for (const mod of trackModules(track)) {
    const s = moduleStats(mod);
    total += s.total; done += s.done;
    lt += s.lessonsTotal; ld += s.lessonsDone; et += s.exTotal; ed += s.exDone;
    mins += mod.estimatedMinutes || 0;
  }
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct, lessonsTotal: lt, lessonsDone: ld, exTotal: et, exDone: ed, mins };
}

function overallStats() {
  let total = 0, done = 0;
  for (const mod of state.curriculum.modules) {
    const s = moduleStats(mod);
    total += s.total; done += s.done;
  }
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function firstIncompleteIn(track) {
  for (const mod of trackModules(track)) {
    for (const l of mod.lessons)
      if (!lessonDone(l.id)) return { kind: 'lesson', module: mod, id: l.id, title: l.title };
    for (const e of mod.exercises)
      if (!exerciseDone(e.id)) return { kind: 'exercise', module: mod, id: e.id, title: e.title };
  }
  return null;
}

/* ---------------- markdown (supported subset) ---------------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(src) {
  if (!src) return '';
  const codeBlocks = [];
  let text = String(src).replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
    codeBlocks.push({ lang: (lang || 'javascript').toLowerCase(), code: code.replace(/\n$/, '') });
    return '\uE000CODE' + (codeBlocks.length - 1) + '\uE000';
  });
  text = escapeHtml(text);
  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (m, c) => {
    inlineCodes.push(c);
    return '\uE000INLINE' + (inlineCodes.length - 1) + '\uE000';
  });
  const inline = (s) => s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const lines = text.split('\n');
  let html = '';
  let i = 0;
  const isCode = (l) => /^\uE000CODE\d+\uE000$/.test(l);
  const isList = (l) => /^(- |\d+\. )/.test(l);
  const isHead = (l) => /^#{1,3} /.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (isCode(line)) {
      const b = codeBlocks[+line.match(/\d+/)[0]];
      html += codeHtml(b.code, b.lang);
      i++;
    } else if (isHead(line)) {
      const level = line.match(/^#+/)[0].length;
      html += '<h' + (level + 1) + '>' + inline(line.replace(/^#{1,3} /, '')) + '</h' + (level + 1) + '>';
      i++;
    } else if (isList(line)) {
      const ordered = /^\d+\. /.test(line);
      const items = [];
      while (i < lines.length && isList(lines[i])) {
        items.push(inline(lines[i].replace(/^(- |\d+\. )/, '')));
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      html += '<' + tag + '><li>' + items.join('</li><li>') + '</li></' + tag + '>';
    } else if (line.trim() === '') {
      i++;
    } else {
      const parts = [];
      while (i < lines.length && lines[i].trim() !== '' && !isHead(lines[i]) && !isList(lines[i]) && !isCode(lines[i])) {
        parts.push(lines[i]);
        i++;
      }
      html += '<p>' + inline(parts.join(' ')) + '</p>';
    }
  }
  html = html.replace(/\uE000INLINE(\d+)\uE000/g, (m, n) => '<code>' + inlineCodes[+n] + '</code>');
  return html;
}

/* ---------------- JS syntax highlighting ---------------- */

const JS_TOKEN = new RegExp(
  '(//[^\\n]*|/\\*[\\s\\S]*?\\*/)' +
  '|(`(?:[^`\\\\]|\\\\.)*`|"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\')' +
  '|\\b(const|let|var|function|return|if|else|for|while|do|class|extends|new|import|from|export|default|async|await|try|catch|finally|throw|switch|case|break|continue|typeof|instanceof|in|of|this|super|static|get|set|yield|delete|void|null|undefined|true|false)\\b' +
  '|(\\b\\d[\\d_]*(?:\\.\\d+)?\\b)' +
  '|\\b(console|require|module|exports|process|JSON|Object|Array|Promise|Map|Set|WeakMap|WeakSet|Symbol|Reflect|Proxy|Error|TypeError|RangeError|document|window|localStorage|fetch|setTimeout|clearTimeout|setInterval|requestAnimationFrame|URL|URLSearchParams|FormData|AbortController)\\b' +
  '|(</?[A-Za-z][A-Za-z0-9.]*)' +
  '|([A-Za-z_$][\\w$]*)',
  'g'
);

function highlightJs(code) {
  let out = '';
  let last = 0;
  let expectFnName = false;
  JS_TOKEN.lastIndex = 0;
  let m;
  while ((m = JS_TOKEN.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index));
    const tok = m[0];
    if (m[1]) out += '<span class="tok-com">' + escapeHtml(tok) + '</span>';
    else if (m[2]) out += '<span class="tok-str">' + escapeHtml(tok) + '</span>';
    else if (m[3]) {
      out += '<span class="tok-kw">' + escapeHtml(tok) + '</span>';
      if (tok === 'function') expectFnName = true;
    }
    else if (m[4]) out += '<span class="tok-num">' + escapeHtml(tok) + '</span>';
    else if (m[5]) out += '<span class="tok-bi">' + escapeHtml(tok) + '</span>';
    else if (m[6]) out += '<span class="tok-tag">' + escapeHtml(tok) + '</span>';
    else if (m[7]) {
      if (expectFnName) {
        out += '<span class="tok-fn">' + escapeHtml(tok) + '</span>';
        expectFnName = false;
      } else {
        out += escapeHtml(tok);
      }
    }
    last = m.index + tok.length;
    if (tok.length === 0) JS_TOKEN.lastIndex++;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

let codeCounter = 0;
function codeHtml(code, lang) {
  const id = 'code-' + (++codeCounter);
  const jsish = /^(js|javascript|jsx|ts|typescript)$/.test(lang);
  const body = jsish ? highlightJs(code) : escapeHtml(code);
  return (
    '<div class="codeblock"><div class="codeblock-bar"><span>' + escapeHtml(lang) +
    '</span><button type="button" data-action="copy" data-target="' + id + '">Copy</button></div>' +
    '<pre><code id="' + id + '">' + body + '</code></pre></div>'
  );
}

/* ---------------- shared chrome ---------------- */

function renderChrome() {
  const s = overallStats();
  const track = activeTrack();
  const ts = trackStats(track);

  // topbar ring
  document.getElementById('ring-pct').textContent = s.pct + '%';
  const C = 119.4;
  document.getElementById('ring-fg').style.strokeDashoffset = String(C - (C * s.pct) / 100);

  // track tabs
  document.getElementById('track-tabs').innerHTML = Object.keys(TRACKS).map((t) =>
    '<a class="track-tab' + (t === track ? ' active' : '') + '" data-track="' + t + '" href="#/track/' + t + '">' +
    trackIcon(t) + '<span>' + TRACKS[t].name + '</span></a>'
  ).join('');

  // sidebar track progress
  document.getElementById('side-track-name').textContent = TRACKS[track].name + ' track';
  document.getElementById('side-pct').textContent = ts.pct + '%';
  const sideBar = document.getElementById('side-bar');
  sideBar.style.width = ts.pct + '%';
  sideBar.classList.toggle('react', track === 'react');

  // sidebar module nav for the active track
  const mods = trackModules(track);
  let firstOpen = -1;
  const doneFlags = mods.map((m) => {
    const st = moduleStats(m);
    return st.total > 0 && st.done === st.total;
  });
  for (let i = 0; i < mods.length; i++) {
    if (!doneFlags[i]) { firstOpen = i; break; }
  }
  document.getElementById('module-nav').innerHTML = mods.map((m, i) => {
    const st = moduleStats(m);
    const cls = doneFlags[i] ? 'done' : (i === firstOpen ? 'current' : '');
    const mark = doneFlags[i]
      ? '<span class="st">✓</span>'
      : (i === firstOpen ? '<span class="pill' + (track === 'react' ? ' react' : '') + '">IN PROGRESS</span>' : '');
    return (
      '<a class="mod-link ' + cls + '" data-track="' + track + '" href="#/module/' + m.id + '">' +
      '<span class="num">' + (i + 1) + '</span>' +
      '<span class="tt"><span class="ttl">' + escapeHtml(m.title) + '</span>' +
      '<span class="sub">' + m.lessons.length + ' lessons · ' + m.exercises.length + ' exercises · ~' + m.estimatedMinutes + ' min</span></span>' +
      mark + '</a>'
    );
  }).join('');

  // active tab
  const h = location.hash || '#/';
  document.querySelectorAll('.tabs a').forEach((a) => {
    const tab = a.getAttribute('data-tab');
    const active =
      (tab === 'roadmap' && (h === '#/' || h === '' || h.startsWith('#/track') || h.startsWith('#/module') || h.startsWith('#/lesson'))) ||
      (tab === 'practice' && (h.startsWith('#/practice') || h.startsWith('#/exercise'))) ||
      (tab === 'progress' && h.startsWith('#/progress'));
    a.classList.toggle('active', !!active);
  });
}

function statusChipFor(mod) {
  const st = moduleStats(mod);
  if (st.total > 0 && st.done === st.total) return '<span class="chip status-done">Completed</span>';
  if (st.done > 0) return '<span class="chip status-current">In progress</span>';
  return '<span class="chip">Not started</span>';
}

function toggleBtn(kind, id, done) {
  const label = kind === 'lesson' ? 'lesson' : 'exercise';
  return '<button type="button" class="btn ' + (done ? 'done-state' : '') + '" data-action="toggle-' +
    kind + '" data-id="' + id + '">' + (done ? '✓ ' + label + ' complete' : 'Mark ' + label + ' complete') + '</button>';
}

/* ---------------- views ---------------- */

function viewRoadmap() {
  const track = activeTrack();
  const mods = trackModules(track);
  const ts = trackStats(track);
  const next = firstIncompleteIn(track);
  const continueHtml = next
    ? '<a class="btn" href="#/' + next.kind + '/' + next.id + '">Continue: ' + escapeHtml(next.title) + ' →</a>'
    : '<a class="btn" href="#/progress">Review your progress →</a>';

  // Staggered entrance — first roadmap visit per session only.
  let seen = false;
  try {
    seen = !!sessionStorage.getItem(ROADMAP_SEEN_KEY);
    if (!seen) sessionStorage.setItem(ROADMAP_SEEN_KEY, '1');
  } catch (e) { seen = true; }

  const rows = mods.map((m, i) => {
    const st = moduleStats(m);
    const pct = st.total === 0 ? 0 : Math.round((st.done / st.total) * 100);
    const done = st.total > 0 && st.done === st.total;
    const pop = state.justCompletedModule === m.id ? ' check-pop' : '';
    const check = done ? '<span class="check"><span class="' + pop.trim() + '">✓</span></span>' : '';
    const enter = seen ? '' : ' enter';
    const delay = seen ? '' : ' style="animation-delay:' + (i * 45) + 'ms"';
    return (
      '<a class="mod-row' + (done ? ' done' : '') + enter + '" data-track="' + track + '"' + delay + ' href="#/module/' + m.id + '">' +
      '<span class="num">' + (i + 1) + '</span>' +
      '<span class="tt"><span class="ttl">' + escapeHtml(m.title) + '</span>' +
      '<span class="sub">' + m.lessons.length + ' lessons · ' + m.exercises.length + ' exercises · ~' + m.estimatedMinutes + ' min</span>' +
      '<span class="bar"><span class="bar-fill' + (track === 'react' ? ' react' : '') + '" style="width:' + pct + '%"></span></span></span>' +
      '<span class="pct">' + pct + '%</span>' + check + '</a>'
    );
  }).join('');

  return (
    '<div class="roadmap-head"><h2>' + TRACKS[track].name + '</h2>' +
    '<span class="counts">' + mods.length + ' modules · ' + ts.lessonsTotal + ' lessons · ' + ts.exTotal + ' exercises · ~' + ts.mins + ' min</span></div>' +
    '<div class="card hero"><p style="margin-bottom:12px">' + ts.done + ' of ' + ts.total + ' items done on this track.</p>' + continueHtml + '</div>' +
    rows
  );
}

function viewModule(mod) {
  if (!mod) return notFound('Module not found.');
  const track = mod.track || 'javascript';
  const mods = trackModules(track);
  const idx = mods.findIndex((m) => m.id === mod.id);
  const prev = mods[idx - 1];
  const next = mods[idx + 1];
  const mst = moduleStats(mod);
  const mAllDone = mst.total > 0 && mst.done === mst.total;
  const modToggleBtn = '<button type="button" class="btn ' + (mAllDone ? 'done-state' : 'ghost') +
    '" data-action="toggle-module" data-id="' + mod.id + '">' +
    (mAllDone ? '✓ Module complete' : 'I already know this — mark module complete') + '</button>';
  const lessons = mod.lessons.map((l) =>
    '<a class="lesson-row" href="#/lesson/' + l.id + '">' +
    '<span class="checkbox ' + (lessonDone(l.id) ? 'on' : '') + '">' + (lessonDone(l.id) ? '✓' : '') + '</span>' +
    '<span class="t">' + escapeHtml(l.title) + '</span>' +
    '<span class="mins">' + (l.minutes || '') + (l.minutes ? ' min' : '') + '</span></a>'
  ).join('');
  const exercises = mod.exercises.map((e) =>
    '<a class="exercise-row" href="#/exercise/' + e.id + '">' +
    '<span class="done-mark">' + (exerciseDone(e.id) ? '✓' : '') + '</span>' +
    '<span class="t">' + escapeHtml(e.title) + '</span>' +
    '<span class="chip ' + e.difficulty + '">' + escapeHtml(e.difficulty || '') + '</span></a>'
  ).join('');
  return (
    '<div class="crumb"><a href="#/">Roadmap</a> · ' + escapeHtml(TRACKS[track].name) + ' · Module ' + (idx + 1) + ' of ' + mods.length + '</div>' +
    '<div class="card"><h2 style="margin:0 0 6px">' + escapeHtml(mod.title) + '</h2>' +
    '<p style="margin:0 0 4px;color:var(--muted)">' + escapeHtml(mod.tagline || '') + '</p>' +
    '<p class="note-small">~' + mod.estimatedMinutes + ' min · ' + mod.lessons.length + ' lessons · ' + mod.exercises.length + ' exercises</p>' +
    '<div style="margin-top:14px">' + modToggleBtn + '</div></div>' +
    '<div class="section-head">Lessons</div><div class="card" style="padding:6px 18px">' + lessons + '</div>' +
    '<div class="section-head">Practice</div><div class="exercise-list">' + exercises + '</div>' +
    '<div class="pager">' +
    (prev ? '<a href="#/module/' + prev.id + '"><span>← Previous module</span>' + escapeHtml(prev.title) + '</a>' : '<span></span>') +
    (next ? '<a href="#/module/' + next.id + '" style="text-align:right"><span>Next module →</span>' + escapeHtml(next.title) + '</a>' : '<span></span>') +
    '</div>'
  );
}

function viewLesson(mod, id) {
  const l = mod.lessons.find((x) => x.id === id);
  if (!l) return notFound('Lesson not found.');
  const flat = [];
  for (const m of trackModules(mod.track || 'javascript'))
    for (const x of m.lessons) flat.push({ module: m, lesson: x });
  const i = flat.findIndex((x) => x.lesson.id === id);
  const prev = flat[i - 1], next = flat[i + 1];
  const done = lessonDone(id);
  let html =
    '<div class="crumb"><a href="#/">Roadmap</a> · <a href="#/module/' + mod.id + '">' + escapeHtml(mod.title) + '</a></div>' +
    '<div class="card"><h2 style="margin:0 0 4px">' + escapeHtml(l.title) + '</h2>' +
    '<p class="lesson-meta">' + (l.minutes ? 'About ' + l.minutes + ' minutes · ' : '') + 'Module: ' + escapeHtml(mod.title) + '</p>' +
    '<div class="lesson-body">' + renderMarkdown(l.body) + '</div>';
  if (l.comparisonNote && l.comparisonNote.trim()) {
    html += '<div class="callout"><h4>Java comparison</h4><div class="lesson-body">' + renderMarkdown(l.comparisonNote) + '</div></div>';
  }
  if (l.keyPoints && l.keyPoints.length) {
    html += '<div class="keypoints"><h4>Key takeaways</h4><ul>' +
      l.keyPoints.map((k) => '<li>' + renderMarkdown(k).replace(/^<p>|<\/p>$/g, '') + '</li>').join('') + '</ul></div>';
  }
  html += '<div class="complete-row">' + toggleBtn('lesson', id, done) + '</div></div>';
  html += '<div class="pager">' +
    (prev ? '<a href="#/lesson/' + prev.lesson.id + '"><span>← Previous lesson</span>' + escapeHtml(prev.lesson.title) + '</a>' : '<span></span>') +
    (next ? '<a href="#/lesson/' + next.lesson.id + '" style="text-align:right"><span>Next lesson →</span>' + escapeHtml(next.lesson.title) + '</a>' : '<span></span>') +
    '</div>';
  return html;
}

function viewExercise(mod, id) {
  const e = mod.exercises.find((x) => x.id === id);
  if (!e) return notFound('Exercise not found.');
  const flat = [];
  for (const m of trackModules(mod.track || 'javascript'))
    for (const x of m.exercises) flat.push({ module: m, exercise: x });
  const i = flat.findIndex((x) => x.exercise.id === id);
  const prev = flat[i - 1], next = flat[i + 1];
  const done = exerciseDone(id);
  let html =
    '<div class="crumb"><a href="#/">Roadmap</a> · <a href="#/module/' + mod.id + '">' + escapeHtml(mod.title) + '</a> · Practice</div>' +
    '<div class="card"><h2 style="margin:0 0 8px">' + escapeHtml(e.title) + '</h2>' +
    '<p><span class="chip ' + (e.difficulty || '') + '">' + escapeHtml(e.difficulty || 'exercise') + '</span></p>' +
    '<div class="lesson-body">' + renderMarkdown(e.prompt) + '</div>';
  if (e.starterCode) {
    html += '<div class="section-head">Starter code</div>' + codeHtml(e.starterCode, 'javascript');
  }
  if (e.hints && e.hints.length) {
    html += '<div class="toggle-block"><button type="button" data-action="show-hints">Show hints (' + e.hints.length + ')</button>' +
      '<ul class="hints-list hidden" id="hints-block">' + e.hints.map((h) => '<li>' + escapeHtml(h) + '</li>').join('') + '</ul></div>';
  }
  html += '<div class="toggle-block"><button type="button" data-action="show-solution">Show solution</button>' +
    '<div id="solution-block" class="hidden">' + codeHtml(e.solution || '', 'javascript') + '</div></div>';
  html += '<div class="complete-row">' + toggleBtn('exercise', id, done) +
    '<span class="note-small">Try it in your own editor first — the solution is there when you need it.</span></div></div>';
  html += '<div class="pager">' +
    (prev ? '<a href="#/exercise/' + prev.exercise.id + '"><span>← Previous exercise</span>' + escapeHtml(prev.exercise.title) + '</a>' : '<span></span>') +
    (next ? '<a href="#/exercise/' + next.exercise.id + '" style="text-align:right"><span>Next exercise →</span>' + escapeHtml(next.exercise.title) + '</a>' : '<span></span>') +
    '</div>';
  return html;
}

function viewPractice() {
  const groups = Object.keys(TRACKS).map((t) => {
    const rows = trackModules(t).map((m) => {
      const items = m.exercises.map((e) =>
        '<a class="exercise-row" href="#/exercise/' + e.id + '">' +
        '<span class="done-mark">' + (exerciseDone(e.id) ? '✓' : '') + '</span>' +
        '<span class="t">' + escapeHtml(e.title) + '</span>' +
        '<span class="chip ' + (e.difficulty || '') + '">' + escapeHtml(e.difficulty || '') + '</span></a>'
      ).join('');
      return '<div class="section-head">' + escapeHtml(m.title) + '</div><div class="exercise-list">' + items + '</div>';
    }).join('');
    return '<div class="section-head" style="color:' + TRACKS[t].color + '">' + TRACKS[t].name + ' track</div>' + rows;
  }).join('');
  const s = overallStats();
  return '<div class="card hero"><h2>Practice</h2><p>' + s.done + ' of ' + s.total +
    ' items done across both tracks. Work them in order, or jump around — they\'re yours.</p></div>' + groups;
}

function viewProgress() {
  const s = overallStats();
  const bars = Object.keys(TRACKS).map((t) => {
    const ts = trackStats(t);
    return '<div class="trackbar-row"><div class="trackbar-head"><span>' + TRACKS[t].name + ' track</span><span>' + ts.pct + '%</span></div>' +
      '<div class="trackbar"><div class="trackbar-fill ' + (t === 'react' ? 'react' : 'js') + '" style="width:' + ts.pct + '%"></div></div></div>';
  }).join('');
  const checklist = Object.keys(TRACKS).map((t) =>
    trackModules(t).map((m, i) => {
      const st = moduleStats(m);
      const done = st.total > 0 && st.done === st.total;
      return '<a class="lesson-row" href="#/module/' + m.id + '">' +
        '<span class="checkbox ' + (done ? 'on' : '') + '">' + (done ? '✓' : '') + '</span>' +
        '<span class="t">' + (i + 1) + '. ' + escapeHtml(m.title) + '</span>' +
        '<span class="mins">' + st.done + '/' + st.total + '</span></a>';
    }).join('')
  ).join('');
  return (
    '<div class="card hero"><h2>Your progress</h2>' +
    '<div class="stats-row">' +
    '<span class="stat"><b>' + s.pct + '%</b>complete</span>' +
    '</div>' +
    '<p class="note-small">Progress is stored locally in your browser — close the app and reopen it, everything is still here.</p></div>' +
    '<div class="card">' + bars + '</div>' +
    '<div class="card" style="padding:6px 18px">' + checklist + '</div>' +
    '<div class="card"><h3 style="margin-top:0">Backup</h3>' +
    '<p class="note-small">Download your progress as a file, or restore it from a backup — ' +
    'handy if you ever clear your browser\'s site data.</p>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    '<button type="button" class="btn ghost" data-action="export-progress">Export progress</button>' +
    '<button type="button" class="btn ghost" data-action="import-progress">Import backup</button>' +
    '<input type="file" id="import-file" accept=".json,application/json" class="hidden">' +
    '</div><p class="note-small" id="import-msg"></p></div>' +
    '<div class="card"><h3 style="margin-top:0">Start over</h3>' +
    '<p class="note-small">Clears all lesson and exercise progress on this machine. This can\'t be undone.</p>' +
    '<button type="button" class="btn danger" data-action="reset">Reset all progress</button></div>'
  );
}

function notFound(msg) {
  return '<div class="card error-card"><h2>Not found</h2><p class="note-small">' +
    escapeHtml(msg) + '</p><a class="btn ghost" href="#/">Back to roadmap</a></div>';
}

/* ---------------- router ---------------- */

let routeToken = 0;
async function route() {
  const myToken = ++routeToken;
  const view = document.getElementById('view');
  const render = (html) => {
    if (myToken !== routeToken) return; // a newer navigation already won
    view.classList.remove('switching');
    view.innerHTML = html;
    renderChrome();
    if (state.switchFlash) {
      state.switchFlash = false;
      void view.offsetWidth; // restart the animation
      view.classList.add('switching');
    }
    state.justCompletedModule = null;
    window.scrollTo(0, 0);
  };
  if (state.loadError) {
    render('<div class="card error-card"><h2>Couldn\'t load the curriculum</h2>' +
      '<p class="note-small">' + escapeHtml(state.loadError) + '</p>' +
      '<p class="note-small">Run the app with <code>python3 run.py</code> so the curriculum files can load.</p></div>');
    return;
  }
  const h = location.hash || '#/';
  try {
    let html;
    if (h === '#/' || h === '') html = viewRoadmap();
    else if (h.startsWith('#/track/')) {
      const t = decodeURIComponent(h.slice(8));
      if (setTrack(t)) state.switchFlash = true;
      html = viewRoadmap();
    }
    else if (h === '#/practice') html = viewPractice();
    else if (h === '#/progress') html = viewProgress();
    else if (h.startsWith('#/module/')) {
      const mod = await ensureModule(decodeURIComponent(h.slice(9)));
      html = viewModule(mod);
    } else if (h.startsWith('#/lesson/')) {
      const id = decodeURIComponent(h.slice(9));
      const mid = moduleOfLesson(id);
      html = mid ? viewLesson(await ensureModule(mid), id) : notFound('Lesson not found.');
    } else if (h.startsWith('#/exercise/')) {
      const id = decodeURIComponent(h.slice(11));
      const mid = moduleOfExercise(id);
      html = mid ? viewExercise(await ensureModule(mid), id) : notFound('Exercise not found.');
    } else html = notFound('That page doesn\'t exist.');
    render(html);
  } catch (err) {
    render('<div class="card error-card"><h2>Couldn\'t load this page</h2>' +
      '<p class="note-small">' + escapeHtml((err && err.message) || String(err)) + '</p>' +
      '<p class="note-small">Run the app with <code>python3 run.py</code> so the curriculum files can load.</p></div>');
  }
}

/* ---------------- events ---------------- */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action');
  if (action === 'toggle-lesson') {
    const id = el.getAttribute('data-id');
    if (lessonDone(id)) delete state.progress.lessons[id];
    else state.progress.lessons[id] = true;
    saveProgress();
    route();
  } else if (action === 'toggle-exercise') {
    const id = el.getAttribute('data-id');
    if (exerciseDone(id)) delete state.progress.exercises[id];
    else state.progress.exercises[id] = true;
    saveProgress();
    route();
  } else if (action === 'copy') {
    const target = document.getElementById(el.getAttribute('data-target'));
    const done = () => {
      const orig = el.textContent;
      el.textContent = 'Copied!';
      setTimeout(() => { el.textContent = orig; }, 1200);
    };
    if (target && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(target.innerText).then(done, done);
    } else if (target) {
      const r = document.createRange();
      r.selectNodeContents(target);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      try { document.execCommand('copy'); } catch (e) {}
      sel.removeAllRanges();
      done();
    }
  } else if (action === 'show-solution') {
    const b = document.getElementById('solution-block');
    if (b) {
      b.classList.toggle('hidden');
      el.textContent = b.classList.contains('hidden') ? 'Show solution' : 'Hide solution';
    }
  } else if (action === 'show-hints') {
    const b = document.getElementById('hints-block');
    if (b) {
      b.classList.toggle('hidden');
      el.textContent = b.classList.contains('hidden')
        ? el.textContent.replace('Hide', 'Show')
        : el.textContent.replace('Show', 'Hide');
    }
  } else if (action === 'export-progress') {
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(state.progress, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'js-react-roadmap-progress-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  } else if (action === 'import-progress') {
    const inp = document.getElementById('import-file');
    if (inp) inp.click();
  } else if (action === 'toggle-module') {
    const mod = findModule(el.getAttribute('data-id'));
    if (mod) {
      const st = moduleStats(mod);
      const allDone = st.total > 0 && st.done === st.total;
      for (const l of mod.lessons) {
        if (allDone) delete state.progress.lessons[l.id];
        else state.progress.lessons[l.id] = true;
      }
      for (const e of mod.exercises) {
        if (allDone) delete state.progress.exercises[e.id];
        else state.progress.exercises[e.id] = true;
      }
      if (!allDone) state.justCompletedModule = mod.id; // checkmark pop on next render
      saveProgress();
      route();
    }
  } else if (action === 'reset') {
    if (window.confirm('Reset all progress? This clears every lesson and exercise on this machine.')) {
      resetProgress();
      route();
    }
  }
});

window.addEventListener('hashchange', route);

document.addEventListener('change', (ev) => {
  if (ev.target && ev.target.id === 'import-file') {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const p = JSON.parse(rd.result);
        if (!p || typeof p !== 'object' || typeof p.lessons !== 'object' || typeof p.exercises !== 'object') {
          throw new Error('bad shape');
        }
        state.progress = {
          lessons: p.lessons || {},
          exercises: p.exercises || {},
          ui: p.ui && TRACKS[p.ui.track] ? { track: p.ui.track } : { track: 'javascript' },
          updatedAt: p.updatedAt || null,
        };
        saveProgress();
        route();
      } catch (e) {
        const msg = document.getElementById('import-msg');
        if (msg) msg.textContent = 'That file doesn\'t look like a progress backup — nothing was changed.';
      }
    };
    rd.readAsText(f);
  }
});

/* ---------------- boot ---------------- */

loadProgress();
fetch(INDEX_URL)
  .then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + INDEX_URL);
    return r.json();
  })
  .then((data) => {
    state.curriculum = data;
    route();
  })
  .catch((err) => {
    state.loadError = err && err.message ? err.message : String(err);
    route();
  });
