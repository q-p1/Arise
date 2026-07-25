/* Spaced repetition — the scheduler must run on real calendar days and
   adapt its interval to how hard each concept is for this specific student. */
export default function ({ test, assert, T }) {
  const { realDay, srsSeed, srsGrade, srsDue, srsInDays, migrateSrs, SRS_EF_DEF, SRS_EF_MIN } = T;

  test("realDay is a stable integer that advances one per calendar day", () => {
    const d1 = new Date("2026-03-10T08:00:00");
    const d2 = new Date("2026-03-10T23:30:00");
    const d3 = new Date("2026-03-11T00:30:00");
    assert.eq(realDay(d1), realDay(d2), "same calendar day must share an index");
    assert.eq(realDay(d3) - realDay(d1), 1, "next day must be +1");
  });

  test("seed schedules into the real future, not the game day", () => {
    const s = srsSeed(1);
    assert.eq(s.due, realDay() + 1);
    assert.eq(s.ivl, 1);
    assert.eq(s.ef, SRS_EF_DEF);
  });

  test("nothing seeded today is due today (no same-session re-review)", () => {
    assert.ok(!srsDue(srsSeed(1)), "a freshly scheduled item must not be due immediately");
    assert.ok(!srsDue(srsSeed(4)));
  });

  test("SM-2 interval ladder: 1 → 6 → ef-scaled", () => {
    let s = srsGrade(null, 5);
    assert.eq(s.ivl, 1, "first success");
    s = srsGrade(s, 5);
    assert.eq(s.ivl, 6, "second success");
    const third = srsGrade(s, 5);
    assert.eq(third.ivl, Math.round(6 * s.ef), "third success scales by ease factor");
    assert.gt(third.ivl, 6, "intervals must grow");
  });

  test("ease factor rises on easy recall and falls on hard recall", () => {
    let easy = srsGrade(null, 5); easy = srsGrade(easy, 5); easy = srsGrade(easy, 5);
    let hard = srsGrade(null, 3); hard = srsGrade(hard, 3); hard = srsGrade(hard, 3);
    assert.gt(easy.ef, hard.ef, "an easy concept must earn a bigger ease factor than a hard one");
    assert.gt(easy.ivl, hard.ivl, "and therefore a longer interval");
  });

  test("ease factor never drops below the SM-2 floor", () => {
    let s = null;
    for (let i = 0; i < 20; i++) s = srsGrade(s, 3);
    assert.gte(s.ef, SRS_EF_MIN, "ef floor protects against runaway shrinkage");
  });

  test("a lapse resets the interval and is counted", () => {
    let s = srsGrade(null, 5); s = srsGrade(s, 5); s = srsGrade(s, 5);
    assert.gt(s.ivl, 6);
    const lapsed = srsGrade(s, 1);
    assert.eq(lapsed.ivl, 1, "forgetting sends the item back to tomorrow");
    assert.eq(lapsed.lapses, 1);
    assert.eq(lapsed.due, realDay() + 1);
  });

  test("intervals are clamped to a sane maximum", () => {
    let s = null;
    for (let i = 0; i < 40; i++) s = srsGrade(s, 5);
    assert.lte(s.ivl, 365, "no 10-year intervals");
  });

  test("REGRESSION: binge-playing cannot fast-forward the schedule", () => {
    // The old bug: due was stored in game days, so pressing "sleep" N times
    // satisfied an N-day interval instantly. Advancing g.day must now do nothing.
    const g = { day: 1, srs: { f1: srsGrade(null, 5) } };
    assert.ok(!srsDue(g.srs.f1), "not due right after review");
    g.day = 999;                       // simulate sleeping 998 times in one sitting
    assert.ok(!srsDue(g.srs.f1), "game-day travel must NOT make a review due");
  });

  test("srsInDays reports real days remaining", () => {
    const s = srsSeed(5);
    assert.eq(srsInDays(s), 5);
  });

  test("migration converts legacy game-day saves once and is idempotent", () => {
    const n = { day: 10, srs: {
      overdue: { lvl: 2, due: 5 },     // was already due under the old system
      future:  { lvl: 3, due: 14 },    // was 4 game-days out
    } };
    migrateSrs(n);
    const today = realDay();
    assert.eq(n.srs.overdue.due, today, "an overdue legacy item becomes due today");
    assert.ok(n.srs.overdue.ivl != null && n.srs.overdue.ef === SRS_EF_DEF, "gains the new schema");
    assert.gt(n.srs.future.due, today, "a future legacy item stays in the future");

    const snapshot = JSON.stringify(n.srs);
    migrateSrs(n);
    assert.eq(JSON.stringify(n.srs), snapshot, "running migration twice must not change anything");
  });

  test("migration leaves already-migrated items untouched", () => {
    const fresh = srsGrade(null, 5);
    const n = { day: 3, srs: { a: { ...fresh } } };
    migrateSrs(n);
    assert.eq(n.srs.a.due, fresh.due);
    assert.eq(n.srs.a.ef, fresh.ef);
  });

  test("mastery threshold reflects real consolidation, not repetition count", () => {
    // Reaching 21+ day intervals takes genuine spaced success, not rapid clicking.
    let s = null, reviews = 0;
    while ((s?.ivl ?? 0) < 21 && reviews < 50) { s = srsGrade(s, 5); reviews++; }
    assert.lte(s.ivl, 365);
    assert.gte(s.ivl, 21);
    assert.gte(reviews, 3, "mastery must require several separated successes");
  });
}
