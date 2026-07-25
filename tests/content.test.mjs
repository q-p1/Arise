/* Authored content: reading passages, the AWL vocabulary track, and the
   academy curriculum graph. These guard against silently shipping a track that
   looks complete in the UI but has no material behind it. */
export default function ({ test, assert, T }) {
  const { QQ, readingGen, GR, ACADEMY, PREREQ, AWL_WORDS, newSave, addMistake, mistakeRec } = T;

  /* ---------------- reading comprehension ---------------- */

  test("passage bank covers all three difficulty levels", () => {
    const byLevel = {};
    QQ._passages.forEach(p => { byLevel[p.level] = (byLevel[p.level] || 0) + 1; });
    [1, 2, 3].forEach(l => assert.gt(byLevel[l] || 0, 0, `level ${l} has no passages`));
  });

  test("every passage question is well formed and answerable from the text", () => {
    const problems = [];
    QQ._passages.forEach(p => {
      if (!p.id) problems.push("passage with no id");
      if (!p.text || p.text.length < 80) problems.push(`${p.id}: passage text too short to support inference`);
      if (!p.questions?.length) problems.push(`${p.id}: no questions`);
      p.questions?.forEach((q, i) => {
        if (!q.q) problems.push(`${p.id}#${i}: no prompt`);
        if (!Array.isArray(q.options) || q.options.length !== 4) problems.push(`${p.id}#${i}: needs exactly 4 options`);
        else if (new Set(q.options.map(String)).size !== 4) problems.push(`${p.id}#${i}: duplicate option`);
        if (typeof q.a !== "number" || q.a < 0 || q.a >= (q.options?.length ?? 0)) problems.push(`${p.id}#${i}: bad answer index`);
        if (!q.ex) problems.push(`${p.id}#${i}: no explanation`);
        if (!q.type) problems.push(`${p.id}#${i}: untyped question`);
      });
    });
    assert.eq(problems.length, 0, `\n      ${problems.join("\n      ")}`);
  });

  test("passage ids are unique", () => {
    const ids = QQ._passages.map(p => p.id);
    assert.eq(new Set(ids).size, ids.length);
  });

  test("readingGen always ships the passage together with its question", () => {
    for (let i = 0; i < 800; i++) {
      const o = readingGen(GR, 1 + (i % 3));
      assert.ok(o, "reading generator must not bail");
      assert.ok(o.q.includes("\n\n"), "question must be preceded by its passage text");
      const set = new Set([o.correct, ...o.wrongs.map(w => w.v)].map(String));
      assert.eq(set.size, 4, "passage question must have 4 distinct options");
    }
  });

  test("readingGen falls back rather than returning nothing for an unknown level", () => {
    assert.ok(readingGen(GR, 99), "an unmapped level must still yield a question");
  });

  /* ---------------- curriculum graph ---------------- */

  test("every prerequisite points at a unit that exists", () => {
    const ids = new Set(ACADEMY.flatMap(p => p.units.map(u => u.id)));
    const bad = [];
    Object.entries(PREREQ).forEach(([uid, reqs]) => {
      if (!ids.has(uid)) bad.push(`PREREQ references unknown unit "${uid}"`);
      reqs.forEach(r => { if (!ids.has(r)) bad.push(`${uid} requires unknown unit "${r}"`); });
    });
    assert.eq(bad.length, 0, `\n      ${bad.join("\n      ")}`);
  });

  test("the prerequisite graph has no cycles (every unit is reachable)", () => {
    const seen = {}, stack = {};
    const visit = (id) => {
      if (stack[id]) throw new Error(`prerequisite cycle at "${id}"`);
      if (seen[id]) return;
      stack[id] = seen[id] = true;
      (PREREQ[id] || []).forEach(visit);
      stack[id] = false;
    };
    Object.keys(PREREQ).forEach(visit);
    assert.ok(true);
  });

  test("every unit offers something to practice", () => {
    const empty = [];
    ACADEMY.forEach(p => p.units.forEach(u => {
      const has = (u.drills && u.drills.length) || u.awl || u.sim || u.genDrills;
      if (!has) empty.push(`${p.id}/${u.id}: ${u.name}`);
    }));
    assert.eq(empty.length, 0, `units with nothing to practice:\n      ${empty.join("\n      ")}`);
  });

  test("every unit teaches before it tests", () => {
    const silent = [];
    ACADEMY.forEach(p => p.units.forEach(u => {
      if (u.sim) return;                               // simulations are pure assessment by design
      const teaches = (u.steps && u.steps.length) || (u.cards && u.cards.length) || u.awl;
      if (!teaches) silent.push(`${p.id}/${u.id}: ${u.name}`);
    }));
    assert.eq(silent.length, 0, `units that test without teaching:\n      ${silent.join("\n      ")}`);
  });

  /* ---------------- AWL vocabulary ---------------- */

  test("every AWL word is complete enough to teach and to drill", () => {
    const bad = [];
    Object.entries(AWL_WORDS).forEach(([pid, words]) => words.forEach(w => {
      if (!w.w || !w.ar || !w.ex || !w.syn) bad.push(`${pid}/${w.w || "?"}: missing field`);
      if (!w.bl || !w.bl.includes("_____")) bad.push(`${pid}/${w.w}: cloze sentence has no blank`);
    }));
    assert.eq(bad.length, 0, `\n      ${bad.join("\n      ")}`);
  });

  /* ---------------- mistakes notebook ---------------- */

  test("the mistakes notebook dedupes and stays bounded", () => {
    const n = newSave();
    const rec = mistakeRec({ q: "2 + 2 =", options: ["3", "4", "5", "6"], a: 1, sec: "arithmetic", ex: "why" }, 0, "mcq");
    addMistake(n, rec, 1);
    addMistake(n, rec, 2);
    assert.eq(n.mistakes.length, 1, "the same question must not pile up");
    assert.eq(n.mistakes[0].ts, 2, "re-missing it refreshes the entry");
    for (let i = 0; i < 100; i++) {
      addMistake(n, mistakeRec({ q: `q${i}`, options: ["a", "b", "c", "d"], a: 0, sec: "algebra", ex: "e" }, 1, "mcq"), i);
    }
    assert.lte(n.mistakes.length, 60, "notebook must stay bounded so saves don't grow forever");
  });
}
