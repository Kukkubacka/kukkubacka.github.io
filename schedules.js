// Pre-computed whist-tournament schedules (generated and verified offline).
// Each round is a list of player slots; every 4 consecutive slots form one court:
// [a1, a2, b1, b2] = pair A (a1+a2) vs pair B (b1+b2).
// Property: every player partners every other player exactly once and
// meets every other player as an opponent exactly twice.
const BASE_SCHEDULES = {
  4: [
    [3, 0, 1, 2],
    [3, 1, 0, 2],
    [3, 2, 0, 1],
  ],
  8: [
    [3, 2, 4, 1, 6, 5, 0, 7],
    [6, 3, 2, 5, 1, 7, 4, 0],
    [6, 2, 0, 1, 5, 3, 4, 7],
    [4, 6, 1, 5, 0, 3, 7, 2],
    [0, 2, 4, 5, 7, 3, 1, 6],
    [0, 6, 4, 3, 1, 2, 7, 5],
    [5, 0, 3, 1, 4, 2, 7, 6],
  ],
  12: [
    [7, 2, 0, 8, 9, 10, 1, 5, 3, 11, 6, 4],
    [8, 3, 1, 9, 10, 0, 2, 6, 4, 11, 7, 5],
    [9, 4, 2, 10, 0, 1, 3, 7, 5, 11, 8, 6],
    [10, 5, 3, 0, 1, 2, 4, 8, 6, 11, 9, 7],
    [0, 6, 4, 1, 2, 3, 5, 9, 7, 11, 10, 8],
    [1, 7, 5, 2, 3, 4, 6, 10, 8, 11, 0, 9],
    [2, 8, 6, 3, 4, 5, 7, 0, 9, 11, 1, 10],
    [3, 9, 7, 4, 5, 6, 8, 1, 10, 11, 2, 0],
    [4, 10, 8, 5, 6, 7, 9, 2, 0, 11, 3, 1],
    [5, 0, 9, 6, 7, 8, 10, 3, 1, 11, 4, 2],
    [6, 1, 10, 7, 8, 9, 0, 4, 2, 11, 5, 3],
  ],
  16: [
    [7, 3, 11, 15, 6, 1, 13, 0, 9, 8, 10, 4, 2, 14, 12, 5],
    [8, 4, 12, 15, 7, 2, 14, 1, 10, 9, 11, 5, 3, 0, 13, 6],
    [9, 5, 13, 15, 8, 3, 0, 2, 11, 10, 12, 6, 4, 1, 14, 7],
    [10, 6, 14, 15, 9, 4, 1, 3, 12, 11, 13, 7, 5, 2, 0, 8],
    [11, 7, 0, 15, 10, 5, 2, 4, 13, 12, 14, 8, 6, 3, 1, 9],
    [12, 8, 1, 15, 11, 6, 3, 5, 14, 13, 0, 9, 7, 4, 2, 10],
    [13, 9, 2, 15, 12, 7, 4, 6, 0, 14, 1, 10, 8, 5, 3, 11],
    [14, 10, 3, 15, 13, 8, 5, 7, 1, 0, 2, 11, 9, 6, 4, 12],
    [0, 11, 4, 15, 14, 9, 6, 8, 2, 1, 3, 12, 10, 7, 5, 13],
    [1, 12, 5, 15, 0, 10, 7, 9, 3, 2, 4, 13, 11, 8, 6, 14],
    [2, 13, 6, 15, 1, 11, 8, 10, 4, 3, 5, 14, 12, 9, 7, 0],
    [3, 14, 7, 15, 2, 12, 9, 11, 5, 4, 6, 0, 13, 10, 8, 1],
    [4, 0, 8, 15, 3, 13, 10, 12, 6, 5, 7, 1, 14, 11, 9, 2],
    [5, 1, 9, 15, 4, 14, 11, 13, 7, 6, 8, 2, 0, 12, 10, 3],
    [6, 2, 10, 15, 5, 0, 12, 14, 8, 7, 9, 3, 1, 13, 11, 4],
  ],
};

/**
 * Builds the regular rounds (n - 1 of them) for n players.
 * @param {number} n               number of players (4, 8, 12 or 16)
 * @param {number[]} slotToPlayer  mapping from schedule slot to player index
 * @returns {{court:number, a:number[], b:number[]}[][]}
 *
 * Courts are assigned so that every player spreads their
 * matches as evenly as possible over the available courts.
 */
function buildRegularRounds(n, slotToPlayer) {
  const base = BASE_SCHEDULES[n];
  if (!base) throw new Error('Unsupported number of players: ' + n);
  const courts = n / 4;
  const groups = base.map(round => {
    const g = [];
    for (let c = 0; c < courts; c++) g.push(round.slice(c * 4, c * 4 + 4).map(s => slotToPlayer[s]));
    return g;
  });
  const assign = balanceCourts(n, courts, groups);
  return groups.map((g, r) =>
    g.map((q, gi) => ({ court: assign[r][gi], a: [q[0], q[1]], b: [q[2], q[3]] }))
      .sort((x, y) => x.court - y.court));
}

/**
 * Chooses, for every round, which group of four plays on which court so that
 * each player uses all courts as evenly as possible.
 * Seeded random-restart local search (deterministic for a given input).
 * Returns assign[round][group] = court.
 */
function balanceCourts(n, courts, groups) {
  const perms = permutations([...Array(courts).keys()]);
  if (perms.length === 1) return groups.map(() => perms[0]);
  let seed = 7;
  const rand = k => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % k; };
  const usage = Array.from({ length: n }, () => new Array(courts).fill(0));
  const apply = (r, perm, s) => groups[r].forEach((g, gi) => g.forEach(p => { usage[p][perm[gi]] += s; }));
  const cost = () => {
    let c = 0;
    for (const u of usage) {
      let mx = -Infinity, mn = Infinity;
      for (const v of u) { c += v * v; if (v > mx) mx = v; if (v < mn) mn = v; }
      c += 50 * Math.max(0, mx - mn - 1) ** 2; // strongly prefer spread <= 1
    }
    return c;
  };
  let best = null, bestCost = Infinity;
  for (let restart = 0; restart < 40 && bestCost > 0; restart++) {
    usage.forEach(u => u.fill(0));
    const assign = groups.map(() => perms[rand(perms.length)]);
    groups.forEach((_, r) => apply(r, assign[r], 1));
    let current = cost();
    for (let pass = 0, improved = true; improved && pass < 50; pass++) {
      improved = false;
      for (let r = 0; r < groups.length; r++) {
        for (const perm of perms) {
          if (perm === assign[r]) continue;
          apply(r, assign[r], -1); apply(r, perm, 1);
          const c = cost();
          if (c < current) { current = c; assign[r] = perm; improved = true; }
          else { apply(r, perm, -1); apply(r, assign[r], 1); }
        }
      }
    }
    if (current < bestCost) { bestCost = current; best = assign.slice(); }
  }
  return best;
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [x, ...p]));
}

/** Sanity check: every pair partners exactly once, opponents evenly spread. */
function verifySchedule(n, rounds) {
  const partner = new Map(), opp = new Map();
  const key = (x, y) => (x < y ? x + '-' + y : y + '-' + x);
  const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  for (const r of rounds) {
    for (const { a, b } of r) {
      inc(partner, key(a[0], a[1]));
      inc(partner, key(b[0], b[1]));
      for (const x of a) for (const y of b) inc(opp, key(x, y));
    }
  }
  const pairs = (n * (n - 1)) / 2;
  const pv = [...partner.values()], ov = [...opp.values()];
  return rounds.length === n - 1 && partner.size === pairs && pv.every(v => v === 1) &&
    opp.size === pairs && ov.every(v => v === 2);
}

if (typeof module !== 'undefined') module.exports = { BASE_SCHEDULES, buildRegularRounds, verifySchedule };
