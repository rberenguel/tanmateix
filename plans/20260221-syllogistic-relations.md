# Plan: Syllogistic / Set-Theory Relations (Idea #3)

**Date:** 2026-02-21
**Scope:** New `SyllogisticRelationType` that replaces the disabled `CategoricalRelationType` in game question generation, enabling Aristotelian syllogism questions (subset / disjoint).

---

## Background & Motivation

The current `CategoricalRelationType` uses a binary `same/different` property. It was disabled in `PathBasedQuestionGenerator.js` with the comment _"Categorical disabled - not interesting enough"_. The problem is cognitive load: "same" and "different" have no logical structure beyond direct equivalence, so the player can guess by counting parity.

Syllogistic (Set Theory) relations elevate this dramatically:

- **Subset** (`A ⊂ B`): "All glirps are snorfs" — every member of A is also in B.
- **Disjoint** (`A ∩ B = ∅`): "No snorfs are blarps" — A and B share no members.

These combine transitively via two valid inference rules (analogous to Aristotle's Barbara and Celarent syllogisms):

| Edge 1    | Edge 2    | Conclusion    |
| --------- | --------- | ------------- |
| A ⊂ B     | B ⊂ C     | A ⊂ C ✓       |
| A ⊂ B     | B ∩ C = ∅ | A ∩ C = ∅ ✓   |
| A ∩ B = ∅ | B ⊂ C     | **Unknown** ✗ |
| A ∩ B = ∅ | B ∩ C = ∅ | **Unknown** ✗ |

The player must mentally construct Venn diagrams to evaluate the conclusion.

---

## Scope Boundary

- This plan covers **only Idea #3** (syllogistic relations).
- Ideas #1 (Indeterminate state), #2 (Distractor premises), #4 (Negations) are explicitly out of scope.
- Existing `CategoricalRelationType.js` is **not touched** — left for backward compat.
- The new type is introduced alongside Linear and Spatial in `availableRelationTypes`.

---

## Inference Rules

```
subset(A,B) ∧ subset(B,C)  →  subset(A,C)     [Barbara]
subset(A,B) ∧ disjoint(B,C) → disjoint(A,C)   [Celarent]
disjoint(A,B) ∧ *           →  unknown          [no valid inference]
```

For paths longer than 3 entities (`entitiesPerPath > 3`), the safe rule is:

- All intermediate edges must be **subset**.
- The last edge may be **subset** or **disjoint**.
- This ensures transitivity holds all the way to the endpoints.

---

## Language / Vocabulary

The existing renderer outputs `[entityA] [relation] [entityB]`. Syllogistic language can fit this pattern naturally:

### Subset vocabularies (A is subset of B)

```
"are all"              → "FOBIX are all GAKUN"
"are a type of"        → "FOBIX are a type of GAKUN"
"are always"           → "FOBIX are always GAKUN"
"belong to"            → "FOBIX belong to GAKUN"
"fall within"          → "FOBIX fall within GAKUN"
```

### Disjoint vocabularies (A and B never overlap)

```
"are never"            → "FOBIX are never GAKUN"
"cannot be"            → "FOBIX cannot be GAKUN"
"are excluded from"    → "FOBIX are excluded from GAKUN"
"are incompatible with"→ "FOBIX are incompatible with GAKUN"
```

Note: disjoint is **symmetric** (`disjoint(A,B) = disjoint(B,A)`), but the rendered premise always uses a fixed vocabulary phrase since the entities are displayed in a fixed order.

---

## Files to Create / Modify

### 1. `relations/SyllogisticRelationType.js` ← **new file**

- Class name: `SyllogisticRelationType`, extends `RelationType` with name `"Syllogistic"`.
- Property on relations: `{ relationType: 'subset' | 'disjoint', direction: 1 }`
  (`direction` is kept for renderer/verifier compatibility; always `1` since both subset and disjoint encode their relationship in `relationType`).
- `createRelation(entities, properties)` — standard.
- `validate(relation)` — checks `relationType` is `'subset'` or `'disjoint'`.
- `inverse(relation)` — disjoint is symmetric (swap entities, keep relationType); subset is NOT symmetric (A⊂B ≠ B⊂A, so inverse is not generated — throw or return null).
- `contradicts(rel1, rel2)` — same entity pair: `subset` and `disjoint` together is a contradiction; two `subset` facts in the same direction don't contradict; two `disjoint` facts are redundant.
- `infer(relations)` — not needed since `Path.getInferredRelation()` handles it; can return `[]`.

### 2. `render/Vocabulary.js` ← **add constant**

Add `SYLLOGISTIC_VOCABULARIES`:

```javascript
export const SYLLOGISTIC_VOCABULARIES = {
  subset: [
    "are all",
    "are a type of",
    "are always",
    "belong to",
    "fall within",
  ],
  disjoint: [
    "are never",
    "cannot be",
    "are excluded from",
    "are incompatible with",
  ],
};
```

Update `getRelationText` to handle `"Syllogistic"` type (read `relationType` property, look up vocabulary).

Update `getCategoricalText` name (or add parallel `getSyllogisticText`).

### 3. `core/Path.js` ← **add syllogistic branch in two methods**

**`generateRelations()`:**

Add `isSyllogistic = this.relationType.name === "Syllogistic"` branch.

For a path `[A, B, C, ..., N]`:

- All edges from `0` to `N-2` must be `subset`.
- Last edge (`N-2` to `N-1`) can be `subset` OR `disjoint` (chosen randomly at `pathProperties.lastEdgeDisjoint`).
- Each edge picks one vocabulary string from the appropriate bucket.

For `entitiesPerPath === 3` specifically, either edge can be `subset`, but only edge 0 can be `subset` when edge 1 is `disjoint` — meaning: edge 0 is always `subset`, edge 1 is randomly `subset` or `disjoint`. This matches the inference table above.

**`getInferredRelation()`:**

Add syllogistic branch:

```
if all edges are subset: conclusion is subset(first, last)
if last edge is disjoint: conclusion is disjoint(first, last)
```

Use the vocabulary stored in `this.pathProperties` (the `lastEdgeDisjoint` flag). Return the relation using `this.vocabulary`.

### 4. `generators/PathBasedQuestionGenerator.js` ← **re-enable + new branch**

**`availableRelationTypes`:**

```javascript
const availableRelationTypes = [
  new LinearRelationType(),
  new SpatialRelationType(2),
  new SyllogisticRelationType(), // ← add this
];
```

**`createPath()`:**

Add `else if (relationType instanceof SyllogisticRelationType)` branch:

- Pick one vocabulary word from `subset` and one from `disjoint` (stored as `vocabulary.subset` and `vocabulary.disjoint`).
- Pick `lastEdgeDisjoint: boolean` (random coin flip) for `pathProperties`.
- Pass to `Path` constructor.

**`createInvalidConclusion()`:**

Add syllogistic branch:

- Valid conclusion is `subset` → invalid conclusion is `disjoint`, and vice versa.
- Swap the `relationType` property; keep same entities (order A,C).
- Pick vocabulary from the other bucket.

### 5. `verification/QuestionVerifier.js` ← **add `verifySyllogisticQuestion`**

Add a new method analogous to `verifyCategoricalQuestion`:

```
- Build subset graph (directed) and disjoint pairs (symmetric).
- Compute transitive closure: if subset(A,B) and subset(B,C) → subset(A,C).
- Compute disjoint expansion: if subset(A,B) and disjoint(B,C) → disjoint(A,C).
- Check conclusion: does subset(c1,c2) or disjoint(c1,c2) hold?
- Compare with question.isValid.
```

Update `verifyQuestion()` dispatch to handle `"Syllogistic"` type.

### 6. `relations/index.js` ← **export new class**

Add `export { SyllogisticRelationType } from './SyllogisticRelationType.js';`

### 7. `main.js` ← **timing**

Add `"Syllogistic"` to the timing branch alongside Linear/Spatial. Syllogistic reasoning (Venn diagram construction) is cognitively closer to Spatial in effort — use the Spatial TPP values as a starting point.

The current timing switch (from context):

```javascript
// Linear: faster, Spatial: slower
```

Add: `Syllogistic` → treat like Spatial (or introduce a third timing tier between them after playtesting).

### 8. `tests/test-basic.js` ← **add syllogistic tests**

Add Test N: Create a `SyllogisticRelationType`, create `subset` and `disjoint` relations, verify `infer` produces the correct conclusion.

---

## Execution Order

1. `relations/SyllogisticRelationType.js` — create the core logic class.
2. `render/Vocabulary.js` — add vocabulary constant and rendering helper.
3. `core/Path.js` — add syllogistic branch to `generateRelations()` and `getInferredRelation()`.
4. `generators/PathBasedQuestionGenerator.js` — re-enable in `availableRelationTypes`, add `createPath` + `createInvalidConclusion` branches.
5. `verification/QuestionVerifier.js` — add `verifySyllogisticQuestion` and dispatch.
6. `relations/index.js` — export.
7. `main.js` — timing config.
8. `tests/test-basic.js` — tests.

---

## Edge Cases & Decisions

| Scenario                            | Decision                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `entitiesPerPath === 2`             | Only 1 premise, no transitive inference possible. Skip syllogistic for 2-entity paths (require ≥ 3).                                                                                                         |
| Path length > 3                     | Only the final edge may be disjoint; all prior edges are subset.                                                                                                                                             |
| Multi-path questions (numPaths > 1) | Syllogistic can coexist with Linear or Spatial in the same question (already handled by the mixed-type verification path).                                                                                   |
| Disjoint as first edge              | Never generated for valid inferences; can appear in "false" answers (createInvalidConclusion swaps subset↔disjoint).                                                                                        |
| `inverse(relation)` for subset      | Not used in game flow (Path generates directed edges). Throw `Error("subset has no inverse")` to catch any unexpected usage.                                                                                 |
| Conclusion vocabulary               | Pick one word from `subset` or `disjoint` pool; store as `vocabulary.conclusionSubset` / `vocabulary.conclusionDisjoint` in `pathProperties` so conclusion text is consistent with premise vocabulary style. |

---

## Example Generated Question

**Premises (shuffled):**

- FOBIX are a type of GAKUN
- GAKUN are never JEPOL

**Conclusion:**

- FOBIX are never JEPOL?

**Answer:** True ✓ (via: FOBIX⊂GAKUN, GAKUN∩JEPOL=∅ → FOBIX∩JEPOL=∅)

---

## Out of Scope for This Plan

- Idea #1: Indeterminate / "Cannot be Determined" answer button.
- Idea #2: Distractor premises.
- Idea #4: Negations ("NOT larger than").
- Changing entity generation (nonsense words work fine for categories).
- A UI label distinguishing "Syllogistic" from "Categorical" mode (the player doesn't need to know the type name).
