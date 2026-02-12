/**
 * Syllogimous v2 - Logic Question Generator
 *
 * Main export file for the v2 architecture.
 * This provides a clean, modular system for generating logic questions
 * with composable premise types.
 */

// Core classes
export {
  Entity,
  Relation,
  RelationType,
  PremiseNetwork,
} from "./core/index.js";

// Relation types
export {
  LinearRelationType,
  SpatialRelationType,
  CategoricalRelationType,
} from "./relations/index.js";

// Utils
export { RandomUtils, EntityFactory } from "./utils/index.js";

// Models
export { Question, MultiQuestion } from "./models/index.js";

// Generators
export {
  PremiseNetworkGenerator,
  ConclusionGenerator,
  QuestionGenerator,
} from "./generators/index.js";
