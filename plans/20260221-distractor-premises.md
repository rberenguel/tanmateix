# Plan: Distractor Premises — Noise Filtering (Idea #2)

**Date:** 2026-02-21
**Scope:** Inject 1–2 valid but logically irrelevant premises into each question to force players to identify which information actually matters.

---

## Background

Currently every premise in `shuffledPremises` participates in the conclusion's logical chain. A player who recognises the entity names in the conclusion can shortcut reasoning by ignoring everything else. Introducing premises about unrelated entities forces genuine parsing of all premises.

The key constraint: **distractor premises must be valid** (no internal contradiction) but **must not connect to the conclusion entity pair** via any inferable path.

---

## Concept

Given a core question about entities `[A, B, C]` with conclusion `A > C`:

- Generate one or two extra entities `[D, E]`.
- Create one or two valid relations among `{D, E}` or between `{D/E}` and `{A, B, C}` — but **not** on any path that reaches both conclusion endpoints.
- Inject them into `shuffledPremises`.

Example distractor that is "safe":
- `D is larger than B` — connects D to B, but D is not in the conclusion.
- The player must identify that D is irrelevant to the A–C conclusion.

---

## Safety Constraint

A distractor premise `D > B` is **unsafe** if it, combined with existing premises, creates a new path from `A` to `C` or from `C` to `A` (or changes the truthiness of the conclusion).

**Safe generation rule (simple):** Distractors only involve at least one brand-new entity (one that does not appear in the conclusion). This guarantees they cannot shorten the A–C path.

Specifically:
- Always create at least one new "distractor entity" per distractor premise.
- The distractor entity can relate to any existing entity except it must not bridge the conclusion gap.
- Since the distractor entity is new, it can't form a transitive bridge between the two conclusion entities via existing premises alone.

This is conservative but sound: the distractor can safely reference existing entities like `B` (the middle entity) without affecting the `A-to-C` conclusion, as long as the distractor entity itself is the "dead end."

---

## Configuration

| Parameter | Default | Range |
|-----------|---------|-------|
| `numDistractors` | 1 | 0–2 |
| Probability of having distractors | configurable | e.g. 50% of questions |

Initially: always inject exactly 1 distractor for questions at difficulty level ≥ 3. Scale to 2 distractors at higher levels. (Difficulty progression is managed in `main.js`.)

---

## Files to Touch

### 1. `generators/PathBasedQuestionGenerator.js`

Add a `injectDistractors(premises, entities, relationType, numDistractors)` method:

1. Create `numDistractors` new entities via `this.entityFactory.createEntity()`.
2. For each distractor entity `D`:
   - Pick a random existing entity from the core set (e.g. `B`, the middle entity — never a conclusion endpoint).
   - Create a valid relation `D [rel] existingEntity` using the same or a different `relationType`.
   - For Linear: pick the same `dimension` as the core path for coherence, or a different dimension for extra confusion.
   - Append relation to the distractors list.
3. Return `[...shuffledPremises, ...distractors]` and re-shuffle.

Call `injectDistractors()` in `generateMultiPathQuestion()` after `shuffledPremises` is built, before the `Question` is constructed.

Update `question.metadata` to include `{ distractorCount: n, distractorEntityIds: [...] }` for debugging/verification.

### 2. `models/Question.js`

No changes required — `metadata` is an open object.

### 3. `verification/QuestionVerifier.js`

No changes required — the verifier already filters premises by type when verifying. Distractor premises that are a different type to the conclusion are already ignored. Distractor premises of the same type that don't connect to conclusion endpoints are harmless (transitive closure won't produce a new A–C path if D is a dead-end entity).

**Optional sanity check:** After injecting distractors, re-run `verifyLinearQuestion()` with the full premise list and confirm the `isValid` flag is unchanged. This catches any accidental bridge-creation.

### 4. `main.js`

Pass `numDistractors` into `generateMultiPathQuestion()` based on difficulty level:
- `level < 3`: 0 distractors
- `3 ≤ level < 6`: 1 distractor (50% of questions)
- `level ≥ 6`: 1–2 distractors (always present)

Adjust timing: each distractor premise adds a small time bonus (e.g. `+0.5 × TPP` per distractor) to `calculateTimeLimit()`.

---

## Edge Cases

| Scenario | Decision |
|----------|----------|
| Multi-path question (numPaths > 1) | Already has multiple entity sets mixed together. Distractors add noise on top — safe since the safety rule (new entities only) still holds. |
| Same-type distractor that accidentally closes the gap | Prevented by the rule: distractor entities are always new. If distractor references only existing non-conclusion entities (e.g. B), it still can't bridge A→C. |
| Spatial distractors in a Linear question | Allowed — a spatial fact about D adds visual noise without logical impact on the linear conclusion. |
| Distractor entity in the displayed premise list | Must be visually indistinguishable from core premises. The player has to figure out it's irrelevant. Do NOT label distractors. |
| Very long paths (5+ entities) | Distractors may be less effective since the player is already overwhelmed. Keep to 1 maximum for paths with 5+ entities. |

---

## Example

**Core premises (about FOBIX, GAKUN, JEPOL):**
- GAKUN is larger than FOBIX
- GAKUN is smaller than JEPOL

**Distractor (about MIVAT — irrelevant entity):**
- MIVAT is larger than GAKUN

**Conclusion:** Is JEPOL larger than FOBIX?

**Answer:** True ✓ (MIVAT is irrelevant to the JEPOL–FOBIX chain)
