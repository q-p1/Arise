/* Every procedural generator is fuzzed. These invariants are what make the
   generated bank trustworthy: an item is useless if the "correct" answer also
   appears as a distractor, or if a distractor is unreachable/degenerate. */
const RUNS = 400;   // per generator; ~75 generators => ~30k items per run

export default function ({ test, assert, T }) {
  const { GENS, makeGen, mkMC, unitGenQs, QQ, validateContent } = T;

  test("the generator registry is populated", () => {
    assert.gt(GENS.length, 60, "expected the full generator set to be registered");
  });

  test("every generator has the required metadata", () => {
    const bad = GENS.filter(g => !g.id || !g.topic || !g.diff || typeof g.gen !== "function");
    assert.eq(bad.length, 0, `generators missing metadata: ${bad.map(g => g.id).join(", ")}`);
  });

  test("generator ids are unique", () => {
    const ids = GENS.map(g => g.id);
    assert.eq(new Set(ids).size, ids.length, "duplicate generator id would make targeting ambiguous");
  });

  test(`every generator produces valid items over ${RUNS} runs`, () => {
    const problems = [];
    for (const gn of GENS) {
      let nulls = 0;
      for (let i = 0; i < RUNS; i++) {
        const q = makeGen(gn, null);
        if (!q) { nulls++; continue; }
        if (!q.q || !String(q.q).trim()) { problems.push(`${gn.id}: empty prompt`); break; }
        if (q.type === "num") {
          if (typeof q.a !== "number" || !isFinite(q.a)) { problems.push(`${gn.id}: non-finite numeric answer`); break; }
        } else {
          if (!Array.isArray(q.options) || q.options.length !== 4) { problems.push(`${gn.id}: ${q.options?.length} options (need 4)`); break; }
          if (typeof q.a !== "number" || q.a < 0 || q.a > 3) { problems.push(`${gn.id}: answer index out of range`); break; }
          const opts = q.options.map(String);
          if (new Set(opts).size !== 4) { problems.push(`${gn.id}: duplicate option — a distractor equals the answer or another distractor`); break; }
          if (opts.some(o => !o.trim() || /NaN|undefined|Infinity/.test(o))) { problems.push(`${gn.id}: degenerate option value`); break; }
        }
      }
      // A generator that almost always bails is effectively dead content.
      if (nulls > RUNS * 0.5) problems.push(`${gn.id}: returned null ${nulls}/${RUNS} times`);
    }
    assert.eq(problems.length, 0, `\n      ${problems.join("\n      ")}`);
  });

  test("every generated item carries an explanation", () => {
    const missing = [];
    for (const gn of GENS) {
      const q = makeGen(gn, null);
      if (q && !q.ex) missing.push(gn.id);
    }
    assert.eq(missing.length, 0, `generators with no explanation: ${missing.join(", ")}`);
  });

  test("distractor reasons map onto the shuffled options (traps)", () => {
    // mkMC shuffles, so each `why` must follow its value to the new index.
    for (let i = 0; i < 300; i++) {
      const mc = mkMC("42", [{ v: "40", why: "off by two" }, { v: "44", why: "added instead" }, { v: "21", why: "halved" }]);
      assert.ok(mc, "mkMC should build a question from three valid distractors");
      assert.eq(mc.options[mc.a], "42", "the answer index must point at the correct value");
      Object.entries(mc.traps).forEach(([idx, why]) => {
        assert.ok(why, "a trap must carry a reason");
        assert.ok(mc.options[idx] !== "42", "the correct answer must never be labelled a trap");
      });
    }
  });

  test("mkMC refuses to build a degenerate question", () => {
    assert.eq(mkMC("", [{ v: "1" }, { v: "2" }, { v: "3" }]), null, "empty answer must be rejected");
    assert.eq(mkMC("NaN", [{ v: "1" }, { v: "2" }, { v: "3" }]), null, "NaN answer must be rejected");
  });

  test("academy units pull only the generators they teach", () => {
    const map = QQ._unitGen;
    const problems = [];
    for (const [uid, cfg] of Object.entries(map)) {
      if (!cfg.gens) continue;                    // topic/difficulty mode
      cfg.gens.forEach(id => {
        if (!GENS.some(g => g.id === id)) problems.push(`${uid} targets unknown generator "${id}"`);
      });
      const qs = unitGenQs(uid, 6, null);
      qs.forEach(q => {
        if (!cfg.gens.includes(q.genId)) problems.push(`${uid} served off-topic generator "${q.genId}"`);
      });
    }
    assert.eq(problems.length, 0, `\n      ${problems.join("\n      ")}`);
  });

  test("number-entry drills reach lessons with a usable numpad shape", () => {
    // unitGenQs normalises type:"num" -> kind:"num" so LessonPlayer renders the pad.
    let sawNum = false;
    for (const uid of Object.keys(QQ._unitGen)) {
      unitGenQs(uid, 8, null).forEach(q => {
        if (q.type === "num") { sawNum = true; assert.eq(q.kind, "num", `${uid}: num item must be tagged kind:"num"`); }
      });
    }
    assert.ok(sawNum, "at least one unit should serve number-entry practice");
  });

  test("content validator reports zero issues", () => {
    assert.eq(validateContent(), 0, "authored content (bank, AWL, drills, passages) must be clean");
  });
}
