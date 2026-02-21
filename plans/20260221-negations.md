# Plan: Negations / Non-Strict Inequalities (Idea #4)

**Date:** 2026-02-21
**Scope:** Introduce "NOT larger than" (≤) and "NOT smaller than" (≥) as valid premise directions in `LinearRelationType`, alongside strict > and <. Players must reason with non-strict inequalities under time pressure.

---

## Background

The current Linear relation uses `direction: 1` (strictly greater) and `direction: -1` (strictly less). The value `direction: 0` exists syntactically (equal) but is handled sparsely.

Non-strict variants add two new semantic states:

| Direction value | Meaning | Example |
|----------------|---------|---------|
| `1`  | A strictly greater than B | "A is larger than B" |
| `-1` | A strictly less than B    | "A is smaller than B" |
| `2`  | A ≥ B (not strictly less) | "A is not smaller than B" |
| `-2` | A ≤ B (not strictly greater) | "A is not larger than B" |
| `0`  | A = B (equal)             | "A is the same size as B" (existing, unchanged) |

The cognitive load: players must track whether premises license a strict or non-strict conclusion, which demands one extra mental computation per chain link.

---

## Inference Rules for Mixed Chains

| Edge 1 | Edge 2 | Conclusion |
|--------|--------|------------|
| A > B (strict)  | B > C (strict)  | A > C (strict) |
| A > B (strict)  | B ≥ C (non-strict) | A > C (strict) |
| A ≥ B (non-strict) | B > C (strict) | A > C (strict) |
| A ≥ B (non-strict) | B ≥ C (non-strict) | A ≥ C (non-strict) |
| A ≥ B (non-strict) | B ≥ C (non-strict) | **NOT** A > C — this is a valid "False" answer |

Key rule: **at least one strict edge anywhere in a chain propagates strictness**. A chain of all non-strict edges can only guarantee a non-strict conclusion.

This creates a new question pattern: premises that are all non-strict, conclusion asks for strict → **False**.

---

## Direction Encoding

Extend `direction` to use `±2` for non-strict:

```
direction: 2   →  A ≥ B  ("A is not smaller than B")
direction: -2  →  A ≤ B  ("A is not larger than B")
```

This is backward-compatible: existing code only compares against `1`, `-1`, `0`. The new directions `±2` need new handling in:
- Prolog fact generation (`addFactToSession`)
- Transitive closure in `QuestionVerifier`
- Vocabulary

Alternatively, use a separate `strict: boolean` flag alongside `direction`. This avoids the `±2` encoding but requires touching more property-reading code. **Recommend `±2` encoding** for minimal change surface.

---

## Prolog / Verification Changes

The current Prolog rule for Linear uses only `larger(X, Y, Dim)` for strict ordering.

Non-strict requires a parallel `larger_or_equal(X, Y, Dim)` predicate:

```prolog
larger_or_equal(X, Y, Dim) :- larger(X, Y, Dim).    % strict implies non-strict
larger_or_equal(X, X, _).                             % reflexivity

% Transitivity for non-strict:
larger_or_equal(X, Z, Dim) :-
    larger_or_equal(X, Y, Dim),
    larger_or_equal(Y, Z, Dim).

% Mixed: strict + non-strict = strict
larger(X, Z, Dim) :-
    larger(X, Y, Dim),
    larger_or_equal(Y, Z, Dim).
larger(X, Z, Dim) :-
    larger_or_equal(X, Y, Dim),
    larger(Y, Z, Dim).
```

However, the current `QuestionVerifier.verifyLinearQuestion()` already uses **JavaScript-based transitive closure** (not Prolog), so updating the Prolog session is not strictly needed — the JS closure logic needs updating instead.

**JS transitive closure update in `QuestionVerifier`:**

Maintain two graphs: `strictlyLess` and `nonStrictlyLess`. Rules:
- `direction 1` (A > B) → `strictlyLess[B].add(A)` ← B is strictly less than A
- `direction -1` (A < B) → `strictlyLess[A].add(B)`
- `direction 2` (A ≥ B) → `nonStrictlyLess[B].add(A)` only
- `direction -2` (A ≤ B) → `nonStrictlyLess[A].add(B)` only

Closure propagation:
- strict + strict → strict
- strict + non-strict → strict
- non-strict + strict → strict
- non-strict + non-strict → non-strict

Then: to verify conclusion `direction: 1` (A > C), check `strictlyLess[C].has(A)` in the closure. To verify `direction: -2` (A ≤ C), check `nonStrictlyLess[A].has(C)`.

---

## Vocabulary

Add negation entries to `LINEAR_VOCABULARIES` for each dimension. Use a new key `nonstrict_forward` and `nonstrict_backward`:

```javascript
size: {
  forward:  ["is larger than", "is bigger than"],          // direction: 1
  backward: ["is smaller than", "is less than"],           // direction: -1
  equal:    ["is equal to", "is the same size as"],        // direction: 0
  nonstrict_forward:  ["is not smaller than", "is at least as large as"],  // direction: 2
  nonstrict_backward: ["is not larger than", "is at most as large as"],    // direction: -2
}
```

Add matching `nonstrict_forward` / `nonstrict_backward` entries for every dimension in `LINEAR_VOCABULARIES`. The Vocabulary helper `pickLinearVocabulary()` can be extended to include these.

---

## Path Generation Changes

### `core/Path.js` — `generateRelations()`

The Linear branch currently picks `useForwardPhrasing` to decide `direction: 1` or `direction: -1`. Extend to also randomly pick non-strict:

```javascript
// Instead of binary strict choice:
const directionPool = [1, -1, 2, -2];  // strict and non-strict
const direction = random.pickRandom(directionPool);
```

Weight strict vs non-strict (e.g. 60% strict, 40% non-strict) to avoid questions that are trivially all-non-strict at low difficulty.

### `core/Path.js` — `getInferredRelation()`

The inferred direction between endpoints is computed from the chain:

```javascript
let hasStrict = false;
for (const rel of this.relations) {
  if (Math.abs(rel.properties.direction) === 1) hasStrict = true;
}
// If any strict edge: conclusion is strict (direction 1 or -1)
// If all non-strict: conclusion is non-strict (direction 2 or -2)
```

The inferred relation's `direction` is set accordingly (positive = forward ordering, negative = backward).

### `generators/PathBasedQuestionGenerator.js` — `createInvalidConclusion()`

For Linear negations, "invalid" can mean:
- Strict conclusion from all non-strict chain (e.g. present direction `1` when the chain only guarantees `2`)
- Wrong direction entirely (existing behavior — swap entities)

Add a new invalid type: **strictness upgrade attack** — take a valid non-strict conclusion and present it as strict. This is a subtle, plausible-looking wrong answer.

---

## Difficulty Integration

Non-strict premises should only appear at higher difficulty levels. In `main.js`, pass an option `allowNonStrict: boolean` into `generateMultiPathQuestion()`:

- `level < 4`: strict only
- `level ≥ 4`: 30% chance of including non-strict edges
- `level ≥ 7`: 50% chance

---

## Files to Touch

| File | Change |
|------|--------|
| `render/Vocabulary.js` | Add `nonstrict_forward` / `nonstrict_backward` for all dimensions |
| `core/Path.js` | Extend direction selection, update `getInferredRelation()` |
| `generators/PathBasedQuestionGenerator.js` | Update `createInvalidConclusion()` with strictness-flip option |
| `verification/QuestionVerifier.js` | Update JS transitive closure to track strict vs non-strict |
| `relations/LinearRelationType.js` | Update `addFactToSession()` for `direction: ±2`; update `validate()` |
| `main.js` | Gate `allowNonStrict` behind difficulty level |

---

## Edge Cases

| Scenario | Decision |
|----------|----------|
| Non-strict + Indeterminate (Idea #1) | Compatible — an indeterminate question can use non-strict premises. The indeterminate-ness comes from graph shape (hub/fork), not strictness. |
| direction: 0 (equal) | Equal implies both ≥ and ≤, so it implies `larger_or_equal` in both directions. Treat equal as implying non-strict in both directions. |
| Conclusion is non-strict but player expects strict | Intentionally ambiguous — this is the difficulty. Vocabulary must be unambiguous: "is not larger than" must clearly mean ≤, not <. |
| Spatial / Syllogistic | Not applicable. Non-strict only targets Linear relations. |
| Very long chains (5 entities) | Strictness propagation handles long chains correctly via the closure rules above. |

---

## Example

**Premises:**
- FOBIX is not larger than GAKUN  (FOBIX ≤ GAKUN)
- GAKUN is not larger than JEPOL  (GAKUN ≤ JEPOL)

**Conclusion:** Is FOBIX smaller than JEPOL? (FOBIX < JEPOL)

**Answer:** False ✗ — the premises only guarantee FOBIX ≤ JEPOL, not strictly less than.

---

**Premises:**
- FOBIX is not larger than GAKUN  (FOBIX ≤ GAKUN)
- GAKUN is larger than JEPOL      (GAKUN > JEPOL)

**Conclusion:** Is FOBIX larger than JEPOL?

**Answer:** False ✗ — FOBIX ≤ GAKUN > JEPOL: no ordering between FOBIX and JEPOL is guaranteed.
