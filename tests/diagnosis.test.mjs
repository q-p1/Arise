/* Misconception diagnosis. Generators already know *why* each distractor is
   tempting; these tests pin down that the app now keeps that signal and turns
   it into something the student can act on. */
export default function ({ test, assert, T }) {
  const { newSave, noteAttempt, topTraps, weakSkills, TRAPS_MAX, mistakeRec, makeGen, GENS, buildChallenges } = T;

  const attempt = (n, over) => noteAttempt(n, { sec: "geometry", skill: "مساحة المثلث", ok: false, t: 20, genId: "geo-tri-area", trap: "نسيت ضرب ½", ...over });

  test("a wrong answer records the specific misconception, not just a miss", () => {
    const n = newSave();
    attempt(n);
    const keys = Object.keys(n.stats.traps);
    assert.eq(keys.length, 1);
    assert.eq(n.stats.traps[keys[0]].why, "نسيت ضرب ½");
    assert.eq(n.stats.traps[keys[0]].n, 1);
    assert.eq(n.stats.traps[keys[0]].genId, "geo-tri-area", "keeps the generator so we can drill the same concept");
  });

  test("repeating the same mistake increments one entry rather than adding rows", () => {
    const n = newSave();
    for (let i = 0; i < 5; i++) attempt(n);
    assert.eq(Object.keys(n.stats.traps).length, 1);
    assert.eq(Object.values(n.stats.traps)[0].n, 5);
  });

  test("correct answers never create a misconception entry", () => {
    const n = newSave();
    noteAttempt(n, { sec: "geometry", skill: "مساحة المثلث", ok: true, t: 10, trap: "نسيت ضرب ½" });
    assert.eq(Object.keys(n.stats.traps).length, 0, "being right must not be logged as a misconception");
    assert.eq(n.stats.bySkill["مساحة المثلث"].c, 1, "but it must still count toward skill mastery");
  });

  test("skill mastery is tracked per skill, not per broad section", () => {
    const n = newSave();
    for (let i = 0; i < 6; i++) noteAttempt(n, { sec: "geometry", skill: "مساحة المثلث", ok: i < 2, t: 12 });
    for (let i = 0; i < 6; i++) noteAttempt(n, { sec: "geometry", skill: "الدائرة", ok: true, t: 12 });
    const weak = weakSkills(n, 5);
    assert.eq(weak[0].name, "مساحة المثلث", "the weak skill must surface even though both live in 'geometry'");
    assert.eq(weak[0].pct, 33);
    assert.eq(weak[weak.length - 1].name, "الدائرة");
  });

  test("a single slip is not treated as a misconception", () => {
    const n = newSave();
    attempt(n);
    assert.eq(topTraps(n).length, 0, "one occurrence could be a mis-tap");
    attempt(n);
    assert.eq(topTraps(n).length, 1, "twice is a pattern worth showing");
  });

  test("misconceptions rank by frequency", () => {
    const n = newSave();
    for (let i = 0; i < 2; i++) attempt(n, { trap: "خلط المحيط بالمساحة" });
    for (let i = 0; i < 7; i++) attempt(n, { trap: "نسيت ضرب ½" });
    const top = topTraps(n, 5);
    assert.eq(top[0].why, "نسيت ضرب ½");
    assert.eq(top[0].n, 7);
  });

  test("the misconception table stays bounded as a save ages", () => {
    const n = newSave();
    for (let i = 0; i < TRAPS_MAX * 3; i++) {
      for (let r = 0; r < (i % 4) + 1; r++) attempt(n, { trap: "خطأ رقم " + i });
    }
    assert.lte(Object.keys(n.stats.traps).length, TRAPS_MAX + 1, "save must not grow without limit");
  });

  test("mistakeRec captures the trap the student actually fell for", () => {
    const q = { q: "مساحة مثلث قاعدته 8 وارتفاعه 3", options: ["12", "24", "11", "16"], a: 0,
                sec: "geometry", skill: "مساحة المثلث", genId: "geo-tri-area",
                traps: { 1: "نسيت ضرب ½", 2: "جمعت بدل الضرب" }, ex: "½×8×3" };
    assert.eq(mistakeRec(q, 1, "mcq").trap, "نسيت ضرب ½");
    assert.eq(mistakeRec(q, 2, "mcq").trap, "جمعت بدل الضرب");
    assert.eq(mistakeRec(q, 3, "mcq").trap, null, "an option with no recorded reason yields no trap");
    assert.eq(mistakeRec(q, 1, "mcq").skill, "مساحة المثلث");
  });

  test("real generated questions carry traps through to the record", () => {
    // Proves the pipeline works on live content, not just a hand-built fixture.
    let found = 0;
    for (const gn of GENS.slice(0, 40)) {
      const q = makeGen(gn, null);
      if (!q || q.type === "num" || !q.traps) continue;
      const wrongIdx = [0, 1, 2, 3].find(i => i !== q.a && q.traps[i] != null);
      if (wrongIdx == null) continue;
      const rec = mistakeRec(q, wrongIdx, "mcq");
      assert.ok(rec.trap, `${gn.id}: a distractor with a reason must produce a trap`);
      assert.eq(rec.genId, gn.id);
      found++;
    }
    assert.gt(found, 10, "most generators should explain their distractors");
  });

  test("targeted drill builds its questions from the student's own weak generators", () => {
    const g = newSave();
    const qs = buildChallenges(["geometry"], 6, g, false, ["geo-tri-area", "geo-rect"]);
    assert.gt(qs.length, 0);
    qs.forEach(q => assert.ok(["geo-tri-area", "geo-rect"].includes(q.genId), `drill served ${q.genId}, which is not a targeted weakness`));
  });

  test("targeted drill falls back to normal selection when targets are unusable", () => {
    const g = newSave();
    const qs = buildChallenges(["geometry"], 6, g, false, ["no-such-generator"]);
    assert.gt(qs.length, 0, "an unknown target must not produce an empty battle");
  });
}
