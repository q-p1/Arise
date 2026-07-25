/* The two signature experiences, and the design system that carries them.

   Both features are gated on evidence: they must fire when the student has a
   real pattern, and stay silent otherwise. A "smart" moment that fires on
   every wrong answer is just a tax, so most of these tests are about restraint
   rather than capability. */
export default function ({ test, assert, T }) {
  const { newSave, noteAttempt, shouldDefend, peekBeatable, beatenTrap, BEAT_AFTER, sigOf, DS, PALETTE } = T;

  const Q = {
    q: "مثلث قاعدته 8 وارتفاعه 3 — مساحته؟",
    options: ["12", "24", "11", "16"], a: 0,
    sec: "geometry", skill: "مساحة المثلث", genId: "geo-tri-area",
    traps: { 1: "نسيت ضرب ½ فحصلت على الضعف", 2: "جمعت القاعدة والارتفاع", 3: "استخدمت قانون المستطيل" },
    ex: "½ × 8 × 3 = 12",
  };
  const hit = (g, why, times) => { for (let i = 0; i < times; i++) noteAttempt(g, { sec: "geometry", skill: "مساحة المثلث", ok: false, t: 20, genId: "geo-tri-area", trap: why }); };

  /* ---------------- Defend Your Answer ---------------- */

  test("stays silent the first time a mistake is made", () => {
    const g = newSave();
    hit(g, Q.traps[1], 1);
    assert.ok(!shouldDefend(g, Q, 1), "one slip is not a misconception — interrupting here would be noise");
  });

  test("appears once the same trap has caught the student twice", () => {
    const g = newSave();
    hit(g, Q.traps[1], 2);
    assert.ok(shouldDefend(g, Q, 1), "a repeat is a pattern worth stopping for");
  });

  test("only fires for the trap actually fallen into", () => {
    const g = newSave();
    hit(g, Q.traps[1], 4);
    assert.ok(shouldDefend(g, Q, 1));
    assert.ok(!shouldDefend(g, Q, 2), "a different distractor with no history must not trigger it");
    assert.ok(!shouldDefend(g, Q, 3));
  });

  test("never fires on a correct answer or an unexplained option", () => {
    const g = newSave();
    hit(g, Q.traps[1], 5);
    assert.ok(!shouldDefend(g, Q, Q.a), "the right answer has no trap to explain");
    assert.ok(!shouldDefend(g, { ...Q, traps: {} }, 1), "no recorded reason means nothing to diagnose");
    assert.ok(!shouldDefend(g, { ...Q, traps: null }, 1));
  });

  test("the decoy reasons are real misconceptions from the same question", () => {
    // The point of the exercise is discriminating *which* error you made,
    // so the alternatives must be genuine and specific, not filler.
    const siblings = Object.entries(Q.traps).filter(([i]) => i !== "1").map(([, w]) => w);
    assert.eq(siblings.length, 2, "this question can supply two real alternatives");
    siblings.forEach(w => assert.ok(w && w !== Q.traps[1], "each decoy must differ from the true reason"));
  });

  /* ---------------- The Moment ---------------- */

  test("does not fire before the trap has caught the student enough times", () => {
    const g = newSave();
    hit(g, Q.traps[1], BEAT_AFTER - 1);
    assert.eq(peekBeatable(g, Q), null, "beating a trap you barely had is not a moment");
  });

  test("fires when a long-standing trap is actively rejected", () => {
    const g = newSave();
    hit(g, Q.traps[1], BEAT_AFTER);
    const m = peekBeatable(g, Q);
    assert.ok(m, "a trap with a real history, refused on a question that offered it");
    assert.eq(m.why, Q.traps[1]);
    assert.eq(m.n, BEAT_AFTER);
  });

  test("only counts traps the question actually offered", () => {
    const g = newSave();
    hit(g, "خطأ من درس مختلف تمامًا", 9);
    assert.eq(peekBeatable(g, Q), null, "avoiding a trap that was never on screen proves nothing");
  });

  test("peeking never mutates — only the reducer marks it beaten", () => {
    const g = newSave();
    hit(g, Q.traps[1], 5);
    const before = JSON.stringify(g.stats.traps);
    peekBeatable(g, Q); peekBeatable(g, Q);
    assert.eq(JSON.stringify(g.stats.traps), before, "a render-time read must be pure");
  });

  test("the moment happens once in a lifetime per trap", () => {
    const g = newSave();
    hit(g, Q.traps[1], 5);
    assert.ok(beatenTrap(g, Q), "first time");
    assert.eq(beatenTrap(g, Q), null, "never again");
    assert.eq(peekBeatable(g, Q), null, "and it stops being offered");
    assert.ok(g.stats.traps[sigOf(Q.traps[1])].beat === true);
  });

  test("a trap can still be re-learned after being beaten without re-firing", () => {
    const g = newSave();
    hit(g, Q.traps[1], 5);
    beatenTrap(g, Q);
    hit(g, Q.traps[1], 3);                     // fell for it again later
    assert.eq(peekBeatable(g, Q), null, "the once-ever moment stays spent");
  });

  /* ---------------- Design system ---------------- */

  test("the type scale has no near-duplicate steps", () => {
    const sizes = Object.values(DS.text).sort((a, b) => a - b);
    for (let i = 1; i < sizes.length; i++) {
      assert.gte(sizes[i] - sizes[i - 1], 1.4, `${sizes[i - 1]} and ${sizes[i]} are too close to be distinct steps`);
    }
  });

  test("every theme defines the same token set", () => {
    const keys = Object.keys(PALETTE.light).sort().join(",");
    ["dark", "usa"].forEach(m => {
      assert.eq(Object.keys(PALETTE[m]).sort().join(","), keys, `${m} is missing or adding tokens`);
    });
  });

  test("motion durations are ordered and bounded", () => {
    const { instant, quick, base, slow, story } = DS.dur;
    assert.ok(instant < quick && quick < base && base < slow && slow < story, "durations must form a scale");
    assert.lte(base, 300, "the default transition must stay snappy");
  });

  test("spacing is a strict 4px grid", () => {
    Object.values(DS.space).forEach(v => assert.eq(v % 4, 0, `${v} breaks the 4px grid`));
  });
}
