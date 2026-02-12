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
