# Plan: Indeterminate State — "Cannot Be Determined" (Idea #1)

**Date:** 2026-02-21
**Scope:** Add a third answer option for questions where the conclusion cannot be logically determined from the premises. Applies primarily to Linear (and later Spatial/Syllogistic).

---

## Background

Currently `isValid: boolean` drives a binary True/False answer. The indeterminate case occurs when premises are consistent but the conclusion is neither provable nor disprovable — e.g.:

```
A > B
C > B
→ Is A > C? Cannot be determined.
```

This requires both:

1. A new **question generation path** that produces underdetermined premise graphs.
2. A new **UI button** and **scoring branch** for the third answer.

---

## Premise Graph Shape

Current generation builds a **chain**: `A > B > C` — always fully deterministic.

For indeterminate, we need a **fork** or **merge** shape:

| Shape  | Premises     | Conclusion query | Status        |
| ------ | ------------ | ---------------- | ------------- |
| Merge  | X > A, X > B | A vs B?          | Indeterminate |
| Fork   | A > X, B > X | A vs B?          | Indeterminate |
| Branch | A > B, A > C | B vs C?          | Indeterminate |

These are valid premise sets (no contradiction) but the conclusion endpoint pair has no inferrable ordering.

---

## Question Generation

### Frequency

Indeterminate questions should appear at a configurable rate (e.g. 25% of questions). A simple approach: after the existing `coinFlip()` for valid/invalid, a second check decides if this is instead an indeterminate question.

### Generation algorithm for Linear indeterminate

1. Pick 3 entities: `[A, B, C]`.
2. Pick a "hub" entity (e.g. `B`) that is either greater than or less than both `A` and `C`.
3. Generate 2 premises with `B` as the hub:
   - `A > B` and `C > B` (both point to hub) — **merge**
   - `B > A` and `B > C` (hub points outward) — **fork**
4. The conclusion is then `A vs C` (or `C vs A`), which is genuinely underdetermined.
5. Generate a random (but plausible-sounding) conclusion between `A` and `C` — always marked `isValid: 'indeterminate'`.

For `entitiesPerPath > 3`: extend the hub shape. E.g. `A > B > hub` and `C > hub` — longer chains merge into a common node.

### Verification

The existing `verifyLinearQuestion()` already computes transitive closure. Extend it: if after closure the conclusion entities have no ordering in either direction, the question is indeterminate.

Add output: `{ valid: true, indeterminate: true }` — the verifier confirms neither direction is provable.

---

## `isValid` — Type Change

Change `isValid` from `boolean` to `boolean | 'indeterminate'`. All existing code compares `question.isValid === true` / `=== false` — these remain valid. The new branch:

```javascript
if (question.isValid === 'indeterminate') { ... }
```

Alternatively: add a separate `question.isIndeterminate: boolean` flag alongside the existing `isValid`, which avoids any existing comparison breakage. **Recommended for minimal diff.**

---

## Files to Touch

### 1. `models/Question.js`

Add `isIndeterminate: boolean` field (default `false`). Constructor reads `config.isIndeterminate`.

### 2. `generators/PathBasedQuestionGenerator.js`

- Add `generateIndeterminateQuestion(numEntities)` method that builds a hub-shaped premise graph.
- In `generateMultiPathQuestion()`: after the existing valid/invalid coin flip, add a ~25% chance to call `generateIndeterminateQuestion()` instead (weighted probability, tunable).
- The generated conclusion between the two "leaf" entities is a random (unverifiable) directional claim.

### 3. `verification/QuestionVerifier.js`

- In `verifyLinearQuestion()`: after transitive closure, check if conclusion pair has no path in either direction. If so, return `{ valid: true, indeterminate: true }`.
- `verifyQuestion()` passes `indeterminate` flag up to caller.
- `PathBasedQuestionGenerator` uses this to confirm indeterminate questions are correctly labelled.

### 4. `render/Renderer.js` — `renderGameUI()`

Add a third button:

```html
<button class="btn btn-indeterminate" data-answer="indeterminate">
  <span class="btn-icon">?</span>
  <span class="btn-text">Cannot be determined</span>
</button>
```

### 5. `main.js`

- `handleAnswer()`: handle `answer === 'indeterminate'` — correct if `question.isIndeterminate`, incorrect otherwise.
- `handleTimeout()`: no change needed (timeout already counts as wrong).
- Timing: indeterminate questions get slightly more time (hub-shaped graphs are cognitively harder to scan quickly). Add ~20% time bonus in `calculateTimeLimit()`.

---

## Edge Cases

| Scenario                                                                   | Decision                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Player answers True/False on an indeterminate question                     | Incorrect                                                                                                                            |
| Player answers "Cannot be determined" on a True/False question             | Incorrect                                                                                                                            |
| Spatial indeterminate (e.g. A is north of B and C is north of B → A vs C?) | Out of scope for initial implementation.                                                                                             |
| Syllogistic indeterminate (disjoint+disjoint → unknown)                    | Already handled by Syllogistic generation avoiding that pattern; can be extended later.                                              |
| Multi-path (mixed type) questions                                          | Indeterminate only applies to the path type used for the conclusion. Restrict indeterminate questions to single-path mode initially. |

---

## Example

**Premises:**

- FOBIX is larger than GAKUN
- JEPOL is larger than GAKUN

**Conclusion:** Is FOBIX larger than JEPOL?

**Answer:** Cannot be determined ✓
