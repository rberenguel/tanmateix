# <img src="icon.png" alt="Tanmateix Icon" width="32" height="32"> Tanmateix

A logic puzzle game where you evaluate whether conclusions logically follow from given premises.

Test your logical reasoning skills by analyzing relationships between entities and determining if conclusions are valid!

Inspired by [Syllogimous-v3](https://github.com/soamsy/Syllogimous-v3).

## About the Game

**Tanmateix** presents you with logical premises and asks you to determine if a conclusion follows logically. Each game consists of 10 questions testing your deductive reasoning abilities.

### Example Question

**Premises:**
- A is larger than B
- B is larger than C

**Conclusion:** A is larger than C?

**Answer:** True ✓

The game features various types of logical relationships including:
- **Linear relationships** (size, speed, brightness, temperature, weight, height)
- **Spatial relationships** (directional positioning)
- **Categorical relationships** (same/different categories)

### Advanced: Multi-Path Questions

The game supports generating questions with multiple premise paths over the **same 3 entities**. Each path uses a different relationship type (linear, spatial, or categorical), creating more complex logical reasoning challenges.

**Example 2-path question:**
- **Entity Graph:** A, B, C
- **Path 1 (Linear):** "A is larger than B", "B is larger than C"
- **Path 2 (Spatial):** "A is north of B", "B is north of C"
- **Conclusion:** "A is larger than C?" (from Path 1)

**Try it in the browser console:**

```javascript
// Generate a 2-path question (4 premises over 3 entities)
window.tanmateix.test2Path()

// Generate a 3-path question (6 premises over 3 entities)
window.tanmateix.test3Path()

// Set number of paths for subsequent questions
window.tanmateix.numPaths = 2
window.tanmateix.newQuestion()
```

Each path creates 2 premises over the same 3 entities:
- 1 path = 2 premises (default single-path)
- 2 paths = 4 premises (2 different relationship types)
- 3 paths = 6 premises (all 3 relationship types)

## Architecture

A modular architecture for generating logic questions with composable premise types.

## File Structure

```
v2/
├── core/
│   ├── Entity.js           - Immutable logical objects
│   ├── Relation.js         - Typed relationships
│   ├── RelationType.js     - Abstract domain logic
│   ├── PremiseNetwork.js   - Graph structure
│   ├── Path.js             - Path utilities
│   └── index.js

├── relations/
│   ├── LinearRelationType.js       - Ordered comparisons
│   ├── SpatialRelationType.js      - Directional relationships
│   ├── CategoricalRelationType.js  - Same/different
│   └── index.js

├── utils/
│   ├── RandomUtils.js      - Random number generation
│   ├── EntityFactory.js    - Entity creation
│   ├── SpatialGrid.js      - Spatial grid utilities
│   └── index.js

├── models/
│   ├── Question.js         - Question structure
│   ├── MultiQuestion.js    - Multi-question structure
│   └── index.js

├── generators/
│   ├── PremiseNetworkGenerator.js     - Network generation
│   ├── ConclusionGenerator.js         - Conclusion generation
│   ├── QuestionGenerator.js           - Main orchestrator
│   ├── PathBasedQuestionGenerator.js  - Path-based questions
│   └── index.js

├── render/
│   ├── Renderer.js         - Question rendering
│   ├── Vocabulary.js       - Vocabulary management
│   └── index.js

├── index.js                - Main exports
├── test-basic.js           - Basic tests
├── test-full.js            - Full integration tests
└── README.md               - This file
```
