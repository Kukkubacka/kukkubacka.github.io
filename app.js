/* Padel Americano – match scheduler and score keeper.
 * Plain browser JavaScript, no build step. State is kept in localStorage.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'americano-app-v1';
  const PLAYER_COUNTS = [4, 8, 12, 16];
  const DEFAULT_POINTS = { 4: 32, 8: 32, 12: 20, 16: 16 };
  const MAX_PLAYERS = 16;
  const MAX_COURTS = 4;
  /** Final round pairings within each group of four in the ranking (indices 0..3 = places 1..4). */
  const FINAL_ORDERS = {
    '14-23': { a: [0, 3], b: [1, 2], label: '1 & 4 vs 2 & 3', notice: '1 + 4 vs 2 + 3, 5 + 8 vs 6 + 7' },
    '13-24': { a: [0, 2], b: [1, 3], label: '1 & 3 vs 2 & 4', notice: '1 + 3 vs 2 + 4, 5 + 7 vs 6 + 8' },
  };
  const DEFAULT_FINAL_ORDER = '14-23';
  /** Final order of the tournament; tournaments saved before the option existed use the default. */
  const finalOrder = () => FINAL_ORDERS[state.finalOrder] || FINAL_ORDERS[DEFAULT_FINAL_ORDER];

  /** Persistent tournament state (null when no tournament has been started). */
  let state = load();
  /** UI-only state. selected === null means "follow the current round". */
  const ui = { mode: state ? 'play' : 'setup', selected: null, showAll: false, draft: null };
  if (!state) ui.draft = newDraft();

  const app = document.getElementById('app');
  const topbar = document.getElementById('topbar-actions');

  // ------------------------------------------------------------------ storage
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const s = raw ? JSON.parse(raw) : null;
      return s && s.version === 1 ? s : null;
    } catch (e) {
      return null;
    }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  // ------------------------------------------------------------------ helpers
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function defaultPlayerName(i) { return 'Player ' + (i + 1); }
  function defaultCourtName(i) { return 'Court ' + (i + 1); }
  /** Value for a name field: default names are left empty so they show as the placeholder. */
  function customName(name, def) { return name && name !== def ? name : ''; }
  const playerName = i => state.players[i];
  /**
   * Pair for the match tables: both names on one line when they fit, otherwise one name per
   * line; a name longer than the column is cut with an ellipsis (full pair in the tooltip).
   */
  const pairNames = pair => `<div class="pair-names" title="${esc(playerName(pair[0]) + ' & ' + playerName(pair[1]))}">
      <span class="pn"><span class="pn-text">${esc(playerName(pair[0]))}</span><span class="amp">&amp;</span></span>
      <span class="pn"><span class="pn-text">${esc(playerName(pair[1]))}</span></span></div>`;

  function shuffled(n) {
    const a = [...Array(n).keys()];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Setup form with default values (8 players, default points, shuffle on, empty names). */
  function newDraft() {
    const n = 8;
    return {
      n,
      points: DEFAULT_POINTS[n],
      shuffle: true,
      finalOrder: DEFAULT_FINAL_ORDER,
      players: new Array(MAX_PLAYERS).fill(''),
      courts: new Array(MAX_COURTS).fill(''),
    };
  }

  // ------------------------------------------------------------------ tournament model
  function startTournament(d) {
    const n = d.n;
    const slotToPlayer = d.shuffle ? shuffled(n) : [...Array(n).keys()];
    const template = buildRegularRounds(n, slotToPlayer);
    if (!verifySchedule(n, template)) throw new Error('Schedule verification failed');
    state = {
      version: 1,
      n,
      points: d.points,
      finalOrder: d.finalOrder,
      players: d.players.slice(0, n).map((p, i) => effectivePlayerName(p, i)),
      courts: d.courts.slice(0, n / 4).map((c, i) => c.trim() || defaultCourtName(i)),
      template, // the n-1 regular rounds; re-used when play continues
      rounds: [],
      ended: false,
    };
    for (let k = 0; k < n - 1; k++) appendRegularRound();
    save();
  }

  /**
   * Appends the next regular round. The first n-1 rounds are the schedule; any further
   * ("extra") rounds repeat the schedule from round 1 onwards.
   */
  function appendRegularRound() {
    const played = state.rounds.filter(r => r.kind === 'regular').length;
    const k = played % state.template.length;
    state.rounds.push({
      kind: 'regular',
      cycle: Math.floor(played / state.template.length) + 1,
      no: k + 1,
      extra: played >= state.template.length,
      matches: state.template[k].map(m => ({ court: m.court, a: m.a.slice(), b: m.b.slice(), sa: null, sb: null })),
    });
  }

  /** Final round: pairings are derived from the standings and frozen once a score is entered. */
  function appendFinalRound() {
    state.rounds.push({ kind: 'final', matches: null });
  }

  const hasFinal = () => state.rounds.some(r => r.kind === 'final');

  const matchDone = m => m.sa !== null && m.sb !== null;
  const roundDone = i => !!state.rounds[i].matches && state.rounds[i].matches.every(matchDone);
  const allBeforeDone = i => state.rounds.slice(0, i).every((_, k) => roundDone(k));

  /** Index of the first round that is not finished, or -1 when everything is played. */
  function currentRoundIndex() {
    for (let i = 0; i < state.rounds.length; i++) if (!roundDone(i)) return i;
    return -1;
  }

  /** Matches of a round; for an unfrozen final they are computed from the standings. */
  function roundMatches(i) {
    const r = state.rounds[i];
    return r.matches || computeFinal(i);
  }

  /** Player statistics over rounds [0, upto). */
  function computeStats(upto) {
    const stats = state.players.map((name, i) => ({ i, name, pf: 0, pa: 0, played: 0, w: 0, d: 0, l: 0 }));
    state.rounds.slice(0, upto).forEach(r => {
      (r.matches || []).forEach(m => {
        if (!matchDone(m)) return;
        const upd = (pair, f, a) => pair.forEach(p => {
          const s = stats[p];
          s.pf += f; s.pa += a; s.played++;
          if (f > a) s.w++; else if (f < a) s.l++; else s.d++;
        });
        upd(m.a, m.sa, m.sb);
        upd(m.b, m.sb, m.sa);
      });
    });
    return stats;
  }

  /** Ranking: points, then wins, then point difference, then original order. */
  function ranking(upto) {
    return computeStats(upto).sort((x, y) =>
      (y.pf - x.pf) || (y.w - x.w) || ((y.pf - y.pa) - (x.pf - x.pa)) || (x.i - y.i));
  }

  /**
   * Final round: per group of four in the ranking, either 1+4 vs 2+3 (5+8 vs 6+7, ...)
   * or 1+3 vs 2+4 (5+7 vs 6+8, ...), as chosen in the setup.
   */
  function computeFinal(i) {
    const rank = ranking(i).map(s => s.i);
    const o = finalOrder();
    const matches = [];
    for (let c = 0; c < state.n / 4; c++) {
      const g = rank.slice(c * 4, c * 4 + 4);
      matches.push({ court: c, a: o.a.map(k => g[k]), b: o.b.map(k => g[k]), sa: null, sb: null });
    }
    return matches;
  }

  const canEnterScores = i => state.rounds[i].kind !== 'final' || !!state.rounds[i].matches || allBeforeDone(i);

  /** Parses a score; returns an integer 0..points, null for empty, or NaN when invalid. */
  function parseScore(text) {
    const t = text.trim();
    if (t === '') return null;
    if (!/^\d{1,3}$/.test(t)) return NaN;
    const v = parseInt(t, 10);
    return v >= 0 && v <= state.points ? v : NaN;
  }

  function setScore(ri, mi, side, value) {
    const r = state.rounds[ri];
    if (!r.matches) r.matches = computeFinal(ri); // freeze final pairings on first entry
    const m = r.matches[mi];
    if (value === null) {
      m.sa = m.sb = null;
    } else if (side === 'a') {
      m.sa = value; m.sb = state.points - value;
    } else {
      m.sb = value; m.sa = state.points - value;
    }
    // An untouched final follows the standings again.
    if (r.kind === 'final' && r.matches.every(x => x.sa === null)) r.matches = null;
    save();
  }

  const anyScores = () => !!state && state.rounds.some(r => r.matches && r.matches.some(m => m.sa !== null));

  function roundLabel(i) {
    const r = state.rounds[i];
    if (r.kind === 'final') return 'Final round';
    const regularBefore = state.rounds.slice(0, i).filter(x => x.kind === 'regular').length;
    return 'Round ' + (regularBefore + 1);
  }
  function chipLabel(i) {
    const r = state.rounds[i];
    if (r.kind === 'final') return 'F';
    return String(state.rounds.slice(0, i).filter(x => x.kind === 'regular').length + 1);
  }

  // ------------------------------------------------------------------ rendering
  function render() {
    const active = document.activeElement;
    const focusKey = active && active.dataset && active.dataset.key;
    const wasScore = !!(active && active.classList && active.classList.contains('score'));

    renderTopbar();
    if (ui.mode === 'play') (state.ended ? renderResults : renderPlay)(); else renderSetup();

    if (focusKey) {
      const el = app.querySelector(`[data-key="${focusKey}"]`);
      if (el && !el.disabled) { el.focus(); if (el.select) el.select(); return; }
    }
    if (wasScore) {
      // The focused round moved on (e.g. it was completed) – focus the first open score field.
      const first = app.querySelector('.score:not(:disabled)');
      if (first && first.value === '') first.focus();
    }
  }

  function renderTopbar() {
    if (ui.mode === 'play' && state.ended) {
      topbar.innerHTML = `
        <button class="btn" data-action="reopen">Back to scoring</button>
        <button class="btn" data-action="print">Print</button>
        <button class="btn" data-action="new">New tournament</button>`;
    } else if (ui.mode === 'play') {
      topbar.innerHTML = `
        <button class="btn" data-action="edit">Edit names</button>
        <button class="btn" data-action="new">New tournament</button>`;
    } else if (ui.mode === 'edit') {
      topbar.innerHTML = `<button class="btn" data-action="cancel-edit">Back to tournament</button>`;
    } else {
      topbar.innerHTML = state ? `<button class="btn" data-action="cancel-edit">Back to tournament</button>` : '';
    }
  }

  // ---- setup / edit
  function renderSetup() {
    const d = ui.draft;
    const editing = ui.mode === 'edit';
    const pointsLocked = editing && anyScores();
    const orderLocked = editing && hasFinal();
    const courts = d.n / 4;

    app.innerHTML = `
      <section class="card setup">
        <h2>${editing ? 'Edit tournament' : 'New Americano tournament'}</h2>
        <div class="field-row">
          <div class="field">
            <span class="label">Players</span>
            <div class="segmented" role="group" aria-label="Number of players">
              ${PLAYER_COUNTS.map(n => `<button type="button" data-action="count" data-n="${n}"
                  class="${n === d.n ? 'active' : ''}" ${editing ? 'disabled' : ''}>${n}</button>`).join('')}
            </div>
          </div>
          <div class="field">
            <label for="points">Points per match</label>
            <input id="points" class="text-input points-input" inputmode="numeric" value="${d.points}"
              ${pointsLocked ? 'disabled title="Points cannot be changed after scores have been entered"' : ''}>
          </div>
          <div class="field">
            <span class="label">Final round</span>
            <div class="segmented" role="group" aria-label="Final round pairings">
              ${Object.entries(FINAL_ORDERS).map(([key, o]) => `<button type="button" data-action="final-order" data-order="${key}"
                  class="${key === d.finalOrder ? 'active' : ''}" ${orderLocked ? 'disabled title="The final round order cannot be changed after the final round has been started"' : ''}>${o.label}</button>`).join('')}
            </div>
          </div>
          <div class="field"><span class="label">Courts</span><div class="static-value">${courts}</div></div>
          ${editing ? '' : `
          <label class="checkbox"><input type="checkbox" id="shuffle" ${d.shuffle ? 'checked' : ''}> Shuffle players randomly</label>`}
        </div>
        <p class="hint">${d.n - 1} rounds + final round. Every player partners every other player exactly once
          and meets every opponent exactly twice.</p>

        <h3>Players</h3>
        <div class="name-grid">
          ${d.players.slice(0, d.n).map((p, i) => `
            <div class="numbered"><span>${i + 1}</span>
              <input class="text-input" data-player="${i}" maxlength="30" placeholder="${defaultPlayerName(i)}" value="${esc(p)}">
            </div>`).join('')}
        </div>

        <h3>Courts</h3>
        <div class="name-grid">
          ${d.courts.slice(0, courts).map((c, i) => `
            <div class="numbered"><span>${i + 1}</span>
              <input class="text-input" data-court="${i}" maxlength="30" placeholder="${defaultCourtName(i)}" value="${esc(c)}">
            </div>`).join('')}
        </div>

        <div class="error-msg" id="setup-error"></div>
        <div class="actions">
          ${state ? `<button class="btn" data-action="cancel-edit">Cancel</button>` : ''}
          <button class="btn primary" data-action="${editing ? 'save-edit' : 'start'}">${editing ? 'Save' : 'Generate schedule'}</button>
        </div>
      </section>`;
    updateNameValidation();
  }

  /** Name as used in the tournament: trimmed, single spaces, empty -> default name. */
  const effectivePlayerName = (p, i) => p.trim().replace(/\s+/g, ' ') || defaultPlayerName(i);

  /** Indices of player fields whose name (case-insensitive) is used more than once. */
  function duplicatePlayers(d) {
    const keys = d.players.slice(0, d.n).map((p, i) => effectivePlayerName(p, i).toLowerCase());
    const dups = new Set();
    keys.forEach((k, i) => { if (keys.indexOf(k) !== i) { dups.add(i); dups.add(keys.indexOf(k)); } });
    return dups;
  }

  /**
   * Live check while names are typed: duplicates are marked red, a message names them and
   * the Generate/Save button stays disabled until every name is unique.
   */
  function updateNameValidation() {
    const d = ui.draft;
    const dups = duplicatePlayers(d);
    app.querySelectorAll('input[data-player]').forEach(el => {
      const bad = dups.has(+el.dataset.player);
      el.classList.toggle('invalid', bad);
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      el.title = bad ? 'This name is already used by another player' : '';
    });
    // One entry per duplicated name (case-insensitive), spelled as in the first field using it.
    const byKey = new Map();
    [...dups].sort((a, b) => a - b).forEach(i => {
      const name = effectivePlayerName(d.players[i], i);
      if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name);
    });
    const names = [...byKey.values()];
    const msg = document.getElementById('setup-error');
    if (msg) {
      msg.textContent = names.length
        ? `Each player needs a unique name – used more than once: ${names.map(n => `"${n}"`).join(', ')}.`
        : '';
    }
    const btn = app.querySelector('.setup .btn.primary');
    if (btn) btn.disabled = names.length > 0;
  }

  function validateDraft(d) {
    const pts = String(d.points).trim();
    if (!/^\d+$/.test(pts) || +pts < 1 || +pts > 999) return 'Points per match must be a whole number between 1 and 999.';
    d.points = +pts;
    if (duplicatePlayers(d).size) return 'Each player needs a unique name.';
    return null;
  }

  // ---- play
  function renderPlay() {
    const cur = currentRoundIndex();
    const sel = displayedRound();
    const last = state.rounds.length - 1;
    const blocks = ui.showAll ? state.rounds.map((_, i) => roundBlock(i, cur)).join('') : roundBlock(sel, cur);

    app.innerHTML = `
      <div class="layout">
        <section class="card pairs-col">
          <div class="pairs-head">
            <h2>Pairings &amp; scores</h2>
            <button class="btn small" data-action="toggle-all">${ui.showAll ? 'Show one round' : 'Show all rounds'}</button>
          </div>
          ${ui.showAll ? '' : `<nav class="round-nav" id="round-nav">${roundNav(cur, sel)}</nav>`}
          ${blocks}
          <div id="round-actions">${roundActions(ui.showAll ? last : sel)}</div>
        </section>
        <aside class="card standings-col">
          <h2>Standings</h2>
          <div id="standings">${standingsTable()}</div>
        </aside>
      </div>`;
  }

  /** Round shown in the single-round view. */
  function displayedRound() {
    const cur = currentRoundIndex();
    const sel = ui.selected === null ? (cur === -1 ? state.rounds.length - 1 : cur) : ui.selected;
    return Math.min(sel, state.rounds.length - 1);
  }

  /**
   * Buttons under a round. They appear as soon as every match of the round has a valid score:
   *  - a round followed by another round:   "Next round"
   *  - last scheduled round:                "Continue playing" or "Start final round"
   *  - last extra round:                    "Next extra round" or "Start final round"
   *    ("Start final round" is shown in every extra round, enabled once the round is complete)
   *  - final round:                         "End tournament"
   * Every completed round also offers "End tournament", so play can be stopped at any time.
   */
  function roundActions(i) {
    const r = state.rounds[i];
    const done = roundDone(i);
    const isLast = i === state.rounds.length - 1;
    const wrap = (inner, hint) => `<div class="actions">${hint ? `<span class="hint actions-hint">${hint}</span>` : ''}${inner}</div>`;
    const endBtn = '<button class="btn" id="end-tournament" data-action="end-tournament">End tournament</button>';

    if (r.kind === 'final') {
      return done ? wrap('<button class="btn primary" id="end-tournament" data-action="end-tournament">End tournament</button>') : '';
    }
    if (!isLast) {
      return done ? wrap(`${endBtn}<button class="btn primary" id="next-round" data-action="next-round">Next round: ${roundLabel(i + 1)} →</button>`) : '';
    }
    if (r.extra) {
      return wrap(`
        ${done ? endBtn : ''}
        ${done ? `<button class="btn" id="next-round" data-action="next-round">Next extra round →</button>` : ''}
        <button class="btn primary" id="start-final" data-action="start-final" ${done ? '' : 'disabled'}>Start final round</button>`,
        done ? '' : 'Enter all scores of this round to start the final.');
    }
    return done ? wrap(`
        ${endBtn}
        <button class="btn" id="continue" data-action="continue">Continue playing (restart from round 1)</button>
        <button class="btn primary" id="start-final" data-action="start-final">Start final round →</button>`) : '';
  }

  function roundNav(cur, sel) {
    return state.rounds.map((r, i) => {
      const cls = ['chip', roundDone(i) ? 'done' : '', i === cur ? 'current' : '', i === sel ? 'selected' : ''].join(' ');
      return `<button class="${cls}" data-action="select" data-r="${i}" title="${roundLabel(i)}">${chipLabel(i)}</button>`;
    }).join('');
  }

  function statusBadge(i, cur) {
    if (roundDone(i)) return `<span class="badge done" data-badge="${i}">Completed</span>`;
    if (i === cur) return `<span class="badge live" data-badge="${i}">Now playing</span>`;
    return `<span class="badge" data-badge="${i}">Upcoming</span>`;
  }

  function roundBlock(i, cur) {
    const r = state.rounds[i];
    const matches = roundMatches(i);
    const editable = canEnterScores(i);
    const badge = statusBadge(i, cur);
    const cycle = r.extra ? `<span class="badge">Extra round · schedule round ${r.no}</span>` : '';
    let notice = '';
    if (r.kind === 'final' && !r.matches) {
      notice = editable
        ? `<p class="notice">Final pairings from the standings: ${finalOrder().notice}, … They are fixed once the first score is entered.</p>`
        : '<p class="notice">Provisional pairings – the final is set from the standings once all previous rounds are complete.</p>';
    }

    const rows = matches.map((m, mi) => {
      const done = matchDone(m);
      const aCls = done ? (m.sa > m.sb ? 'win' : m.sa < m.sb ? 'loss' : '') : '';
      const bCls = done ? (m.sb > m.sa ? 'win' : m.sb < m.sa ? 'loss' : '') : '';
      const inp = (side, v) => `<input class="score" inputmode="numeric" autocomplete="off" maxlength="3"
          data-r="${i}" data-m="${mi}" data-s="${side}" data-key="${i}-${mi}-${side}"
          value="${v === null ? '' : v}" placeholder="–" ${editable ? '' : 'disabled'}
          aria-label="${esc(state.courts[m.court])}, score for ${side === 'a' ? 'left' : 'right'} pair">`;
      return `<tr>
          <td class="court">${esc(state.courts[m.court])}</td>
          <td class="pair ${aCls}">${pairNames(m.a)}</td>
          <td class="scores">${inp('a', m.sa)}<span class="dash">–</span>${inp('b', m.sb)}</td>
          <td class="pair right ${bCls}">${pairNames(m.b)}</td>
        </tr>`;
    }).join('');

    return `
      <div class="round-block">
        <div class="round-title"><h3>${roundLabel(i)}</h3>${badge}${cycle}</div>
        ${notice}
        <table class="match-table scoring">
          <colgroup><col class="col-court"><col><col class="col-scores"><col></colgroup>
          <thead><tr><th>Court</th><th>Pair</th><th class="center">Score</th><th class="num">Pair</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ---- results (after "End tournament")
  function renderResults() {
    const rank = ranking(state.rounds.length);
    const podium = rank.slice(0, 3).map((s, k) => `
        <div class="podium-place p${k + 1}">
          <div class="podium-rank">${['1st', '2nd', '3rd'][k]}</div>
          <div class="podium-name" title="${esc(s.name)}">${esc(s.name)}</div>
          <div class="podium-pts">${s.pf} pts</div>
        </div>`).join('');

    const games = state.rounds.map((r, i) => {
      const rows = (r.matches || []).filter(matchDone).map(m => {
        const aCls = m.sa > m.sb ? 'win' : m.sa < m.sb ? 'loss' : '';
        const bCls = m.sb > m.sa ? 'win' : m.sb < m.sa ? 'loss' : '';
        return `<tr>
            <td class="court">${esc(state.courts[m.court])}</td>
            <td class="pair ${aCls}">${pairNames(m.a)}</td>
            <td class="scores result-score">${m.sa}<span class="dash">–</span>${m.sb}</td>
            <td class="pair right ${bCls}">${pairNames(m.b)}</td>
          </tr>`;
      }).join('');
      if (!rows) return '';
      const extra = r.extra ? '<span class="badge">Extra round</span>' : '';
      return `<div class="round-block">
          <div class="round-title"><h3>${roundLabel(i)}</h3>${extra}</div>
          <table class="match-table scoring results">
            <colgroup><col class="col-court"><col><col class="col-scores"><col></colgroup>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }).join('');

    app.innerHTML = `
      <div class="layout">
        <section class="card pairs-col">
          <h2>Played games</h2>
          ${games}
        </section>
        <aside class="card standings-col">
          <h2>Final results</h2>
          <div class="podium">${podium}</div>
          <div id="standings">${standingsTable()}</div>
        </aside>
      </div>`;
  }

  /**
   * Standings column header with a tooltip. It opens on hover, and on keyboard focus or tap
   * (tabindex makes the header focusable, so it also works on touch screens).
   */
  const tipHeader = (label, tip) => `<th class="num"><span class="tip" tabindex="0" aria-label="${esc(label)}: ${esc(tip)}"
      data-tip="${esc(tip)}">${esc(label)}</span></th>`;

  function standingsTable() {
    const rank = ranking(state.rounds.length);
    const rows = rank.map((s, k) => {
      const diff = s.pf - s.pa;
      return `<tr class="${k === 0 && s.played > 0 ? 'top' : ''}">
          <td class="rank">${k + 1}.</td>
          <td class="player">${esc(s.name)}</td>
          <td class="num pts">${s.pf}</td>
          <td class="num">${s.played}</td>
          <td class="num sub">${s.w}-${s.d}-${s.l}</td>
          <td class="num sub">${diff > 0 ? '+' : ''}${diff}</td>
        </tr>`;
    }).join('');
    return `<table class="standings">
        <thead><tr><th>#</th><th>Player</th>
          ${tipHeader('Pts', "Points: total of the points scored by the player's pair in each match")}
          ${tipHeader('M', 'Matches played')}
          ${tipHeader('W-D-L', 'Won – drawn – lost matches')}
          ${tipHeader('+/-', 'Point difference: points scored minus points conceded')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="hint">${state.points} points per match · ties broken by wins, then point difference.</p>
      <div class="storage-actions">
        <button class="btn small danger" id="clear-storage" data-action="clear-storage">Clear saved data</button>
      </div>`;
  }

  // ------------------------------------------------------------------ events
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;

    switch (action) {
      case 'final-order':
        ui.draft.finalOrder = btn.dataset.order;
        render();
        break;
      case 'count': {
        const n = +btn.dataset.n;
        ui.draft.n = n;
        ui.draft.points = DEFAULT_POINTS[n];
        render();
        break;
      }
      case 'start': {
        const err = validateDraft(ui.draft);
        if (err) { document.getElementById('setup-error').textContent = err; return; }
        if (state && !confirm('Start a new tournament? The current tournament and its scores will be lost.')) return;
        startTournament(ui.draft);
        ui.mode = 'play'; ui.selected = null; ui.showAll = false;
        render();
        break;
      }
      case 'edit':
        ui.draft = {
          n: state.n, points: state.points, shuffle: false, finalOrder: state.finalOrder || DEFAULT_FINAL_ORDER,
          players: Array.from({ length: MAX_PLAYERS }, (_, i) => customName(state.players[i], defaultPlayerName(i))),
          courts: Array.from({ length: MAX_COURTS }, (_, i) => customName(state.courts[i], defaultCourtName(i))),
        };
        ui.mode = 'edit';
        render();
        break;
      case 'save-edit': {
        const err = validateDraft(ui.draft);
        if (err) { document.getElementById('setup-error').textContent = err; return; }
        state.players = ui.draft.players.slice(0, state.n).map((p, i) => effectivePlayerName(p, i));
        state.courts = ui.draft.courts.slice(0, state.n / 4).map((c, i) => c.trim() || defaultCourtName(i));
        if (!anyScores()) state.points = ui.draft.points;
        if (!hasFinal()) state.finalOrder = ui.draft.finalOrder;
        save();
        ui.mode = 'play';
        render();
        break;
      }
      case 'cancel-edit':
        ui.mode = 'play';
        render();
        break;
      case 'new':
        ui.draft = newDraft();
        ui.mode = 'setup';
        render();
        break;
      case 'toggle-all':
        ui.showAll = !ui.showAll;
        render();
        break;
      case 'next-round': {
        const next = (ui.showAll ? state.rounds.length - 1 : displayedRound()) + 1;
        if (next >= state.rounds.length) { appendRegularRound(); save(); }
        goToRound(next);
        break;
      }
      case 'continue':
        appendRegularRound();
        save();
        goToRound(state.rounds.length - 1);
        break;
      case 'start-final':
        if (!hasFinal() && allBeforeDone(state.rounds.length)) {
          appendFinalRound();
          save();
          goToRound(state.rounds.length - 1);
        }
        break;
      case 'end-tournament':
        state.ended = true;
        save();
        window.scrollTo(0, 0);
        render();
        break;
      case 'reopen':
        state.ended = false;
        save();
        ui.selected = null;
        render();
        break;
      case 'clear-storage':
        if (!confirm('Are you sure you want to clear the saved data?\n\n'
          + 'The current tournament, its players and all scores will be deleted. This cannot be undone.')) return;
        try { localStorage.removeItem(STORAGE_KEY); sessionStorage.clear(); } catch (e) { /* storage unavailable */ }
        state = null;
        ui.mode = 'setup'; ui.selected = null; ui.showAll = false;
        ui.draft = newDraft();
        window.scrollTo(0, 0);
        render();
        break;
      case 'print':
        window.print();
        break;
      case 'select': {
        const i = +btn.dataset.r;
        ui.selected = i === currentRoundIndex() ? null : i;
        render();
        break;
      }
    }
  });

  /** Shows round i and puts the cursor in its first empty score field. */
  function goToRound(i) {
    ui.selected = i === currentRoundIndex() ? null : i;
    render();
    const block = ui.showAll ? app.querySelectorAll('.round-block')[i] : app;
    const first = block && block.querySelector('.score:not(:disabled)');
    if (first && first.value === '') first.focus();
  }

  document.addEventListener('input', e => {
    const t = e.target;
    if (ui.mode !== 'play') {
      if (t.dataset.player !== undefined) { ui.draft.players[+t.dataset.player] = t.value; updateNameValidation(); }
      else if (t.dataset.court !== undefined) ui.draft.courts[+t.dataset.court] = t.value;
      else if (t.id === 'points') ui.draft.points = t.value;
      else if (t.id === 'shuffle') ui.draft.shuffle = t.checked;
      return;
    }
    if (!t.classList.contains('score')) return;

    const ri = +t.dataset.r, mi = +t.dataset.m, side = t.dataset.s;
    const v = parseScore(t.value);
    const other = app.querySelector(`[data-key="${ri}-${mi}-${side === 'a' ? 'b' : 'a'}"]`);
    if (Number.isNaN(v)) {
      t.classList.add('invalid');
      t.title = `Enter a whole number between 0 and ${state.points}`;
      return; // invalid input is never stored; it is reverted when the field loses focus
    }
    t.classList.remove('invalid');
    t.title = '';
    if (other) { other.classList.remove('invalid'); other.value = v === null ? '' : String(state.points - v); }
    // Stay on the round being scored; moving on is done with the "Next round" button.
    if (!ui.showAll && ui.selected === null) ui.selected = ri;
    setScore(ri, mi, side, v);
    // Live update of the standings and the round navigation; the full redraw happens on change.
    document.getElementById('standings').innerHTML = standingsTable();
    const badge = app.querySelector(`[data-badge="${ri}"]`);
    if (badge) badge.outerHTML = statusBadge(ri, currentRoundIndex());
    const slot = document.getElementById('round-actions');
    if (slot) slot.innerHTML = roundActions(ui.showAll ? state.rounds.length - 1 : ri);
  });

  // A score field fires "change" when it loses focus – which also happens on mousedown when the
  // user clicks a button. Redrawing at that moment would replace the button before mouseup and
  // the click would be lost, so while a pointer is pressed the redraw waits until it is released
  // (the click handler runs first).
  let pointerDown = false;
  let renderPending = false;
  function scheduleRender() {
    if (pointerDown) { renderPending = true; return; }
    setTimeout(render, 0);
  }
  document.addEventListener('pointerdown', () => { pointerDown = true; }, true);
  const release = () => {
    pointerDown = false;
    if (renderPending) { renderPending = false; setTimeout(render, 0); }
  };
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);

  document.addEventListener('change', e => {
    if (ui.mode === 'play' && e.target.classList.contains('score')) scheduleRender();
    if (e.target.id === 'shuffle') ui.draft.shuffle = e.target.checked;
  });

  // ---- name fields: the old name is cleared as soon as the user starts writing.
  // Focusing selects the text (visual cue). The first typed character, paste or
  // Backspace/Delete replaces the whole name. Moving the cursor first (arrow keys,
  // Home/End or a second click) means "edit the existing name" and keeps it.
  const isNameField = t => t && t.matches && t.matches('input[data-player], input[data-court]');
  const freshNameFields = new WeakSet();
  document.addEventListener('focusin', e => {
    const t = e.target;
    if (!isNameField(t)) return;
    freshNameFields.add(t);
    t.select();
  });
  document.addEventListener('mousedown', e => {
    // A click inside an already focused field places the cursor -> edit mode.
    if (isNameField(e.target) && document.activeElement === e.target) freshNameFields.delete(e.target);
  });
  document.addEventListener('mouseup', e => {
    // Keep the selection made on focus (some browsers collapse it on mouseup).
    if (isNameField(e.target) && freshNameFields.has(e.target)) e.preventDefault();
  });
  document.addEventListener('beforeinput', e => {
    const t = e.target;
    if (!isNameField(t) || !freshNameFields.has(t)) return;
    freshNameFields.delete(t);
    if (t.value !== '') t.value = '';
    if (e.inputType.startsWith('delete')) {
      e.preventDefault(); // Backspace/Delete just clears the field
      t.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  document.addEventListener('keydown', e => {
    if (isNameField(e.target) && /^(Arrow|Home|End)/.test(e.key)) freshNameFields.delete(e.target);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (t.classList && t.classList.contains('score')) {
      // Enter jumps to the next match's first score field.
      e.preventDefault();
      const all = [...app.querySelectorAll('.score[data-s="a"]:not(:disabled)')];
      const idx = all.findIndex(x => x.dataset.r === t.dataset.r && x.dataset.m === t.dataset.m);
      const next = all[idx + 1];
      if (next) next.focus();
      else {
        t.blur();
        // After the redraw, Enter on the last score moves focus to the main round button.
        setTimeout(() => { const b = app.querySelector('#round-actions .btn.primary:not(:disabled)'); if (b) b.focus(); }, 10);
      }
    } else if (ui.mode !== 'play' && t.classList && t.classList.contains('text-input')) {
      e.preventDefault();
      const btn = app.querySelector('.btn.primary');
      if (btn) btn.click();
    }
  });

  render();
})();
