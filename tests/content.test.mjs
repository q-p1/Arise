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

  test("every taught unit is interactive, not a wall of cards", () => {
    // Vocabulary packs have their own word-card flow; simulations are assessment.
    const passive = [];
    ACADEMY.forEach(p => p.units.forEach(u => {
      if (u.sim || u.awl) return;
      if (!u.steps || !u.steps.length) passive.push(`${p.id}/${u.id}: ${u.name}`);
    }));
    assert.eq(passive.length, 0, `card-only units left:\n      ${passive.join("\n      ")}`);
  });

  test("interactive lessons follow the teach -> practise -> warn shape", () => {
    const bad = [];
    ACADEMY.forEach(p => p.units.forEach(u => {
      if (!u.steps?.length) return;
      const kinds = u.steps.map(s => s.k);
      kinds.forEach((k, i) => { if (!["teach", "example", "check", "trap"].includes(k)) bad.push(`${u.id}#${i}: unknown step kind "${k}"`); });
      if (!kinds.includes("teach")) bad.push(`${u.id}: never explains the idea`);
      if (!kinds.includes("check")) bad.push(`${u.id}: never checks understanding`);
      u.steps.forEach((s, i) => {
        if (s.k === "check") {
          if (!Array.isArray(s.options) || s.options.length < 2) bad.push(`${u.id}#${i}: check needs options`);
          else if (typeof s.a !== "number" || s.a < 0 || s.a >= s.options.length) bad.push(`${u.id}#${i}: check has a bad answer index`);
          else if (new Set(s.options.map(String)).size !== s.options.length) bad.push(`${u.id}#${i}: check has duplicate options`);
          if (!s.ex) bad.push(`${u.id}#${i}: check gives no feedback`);
        }
        if (s.k === "example" && (!Array.isArray(s.steps) || !s.steps.length)) bad.push(`${u.id}#${i}: worked example has no steps`);
      });
    }));
    assert.eq(bad.length, 0, `\n      ${bad.join("\n      ")}`);
  });

  test("a drill never references a passage it does not show", () => {
    // Regression: drills used to say "Same text:" and rely on the previous
    // question still being on screen, which broke once questions were shuffled.
    const orphans = [];
    ACADEMY.forEach(p => p.units.forEach(u => (u.drills || []).forEach((d, i) => {
      if (/Same (text|passage)|نفس (النص|القطعة)/i.test(d.q || "")) orphans.push(`${u.id}#${i}`);
    })));
    assert.eq(orphans.length, 0, `drills depending on an unshown passage: ${orphans.join(", ")}`);
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

  test("no AWL headword is taught twice", () => {
    // A repeat wastes a slot and lets the same word be both the prompt and a
    // distractor in a generated drill.
    const seen = {}, dups = [];
    Object.entries(AWL_WORDS).forEach(([pid, words]) => words.forEach(w => {
      if (seen[w.w]) dups.push(`"${w.w}" in both ${seen[w.w]} and ${pid}`);
      else seen[w.w] = pid;
    }));
    assert.eq(dups.length, 0, `\n      ${dups.join("\n      ")}`);
  });

  test("the cloze blank does not give the answer away", () => {
    const leaks = [];
    Object.entries(AWL_WORDS).forEach(([pid, words]) => words.forEach(w => {
      const stem = w.w.toLowerCase().slice(0, Math.max(4, w.w.length - 3));
      if (w.bl.toLowerCase().replace("_____", "").includes(stem)) leaks.push(`${pid}/${w.w}: the blank sentence contains the word itself`);
    }));
    assert.eq(leaks.length, 0, `\n      ${leaks.join("\n      ")}`);
  });

  test("each AWL pack is big enough to generate four distinct options", () => {
    const thin = Object.entries(AWL_WORDS).filter(([, w]) => w.length < 4).map(([p, w]) => `${p} has only ${w.length}`);
    assert.eq(thin.length, 0, `\n      ${thin.join("\n      ")}`);
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
