import { Path } from '../core/Path.js';
import { Question } from '../models/Question.js';
import { LinearRelationType } from '../relations/LinearRelationType.js';
import { SpatialRelationType } from '../relations/SpatialRelationType.js';
import { CategoricalRelationType } from '../relations/CategoricalRelationType.js';
import { PremiseNetwork } from '../core/PremiseNetwork.js';
import { LINEAR_VOCABULARIES, SPATIAL_VOCABULARIES, CATEGORICAL_VOCABULARIES } from '../render/Vocabulary.js';
import { SpatialGrid } from '../utils/SpatialGrid.js';

/**
 * PathBasedQuestionGenerator - new architecture using Path abstraction
 *
 * Generates questions by:
 * 1. Creating entity graph
 * 2. Defining paths through the graph (each with consistent type/vocab)
 * 3. Extracting premises from paths
 * 4. Generating conclusions from one path
 */
export class PathBasedQuestionGenerator {
  constructor(config) {
    this.config = config;
    this.random = config.random;
    this.entityFactory = config.entityFactory;
  }

  /**
   * Generate a level 0 question: 2 premises, 1 path, 3 entities
   */
  generateLevel0Question() {
    // Create 3 entities
    const entities = this.entityFactory.createEntities(3);

    // Pick one relationship type
    const relationTypes = [
      new LinearRelationType(),
      new SpatialRelationType(2),
      new CategoricalRelationType()
    ];
    const relationType = this.random.pickRandom(relationTypes);

    // Generate one path through all 3 entities
    const path = this.createPath(entities, relationType);

    // Build network for consistency with existing code
    const network = new PremiseNetwork();
    entities.forEach(e => network.addEntity(e));
    path.getPremises().forEach(r => network.addRelation(r));

    // Get premises and conclusion
    const premises = path.getPremises(); // 2 premises
    const inferredRelation = path.getInferredRelation(); // The conclusion

    // Randomly decide if valid or invalid
    const isValid = this.random.coinFlip();
    let conclusion;

    if (isValid) {
      conclusion = inferredRelation;
    } else {
      // Create invalid conclusion (flip the direction)
      conclusion = this.createInvalidConclusion(path, inferredRelation);
    }

    // DEBUG LOGGING
    console.log('=== GENERATED QUESTION ===');
    console.log('Relation Type:', relationType.name);
    console.log('Entities:', entities.map(e => e.displayValue));

    if (relationType.name === 'Spatial') {
      console.log('Grid Layout:');
      console.log(path.pathProperties.spatialGrid.toString());
      console.log('Edge Vectors:', path.pathProperties.edgeVectors);
    }

    console.log('Vocabulary:', path.vocabulary);
    console.log('Premises:');
    premises.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.entities[0].displayValue} [${p.properties.text}] ${p.entities[1].displayValue}`);
      if (p.properties.vector) {
        console.log(`     Vector:`, p.properties.vector);
      }
    });
    console.log('Conclusion:', `${conclusion.entities[0].displayValue} [${conclusion.properties.text}] ${conclusion.entities[1].displayValue}`);
    if (conclusion.properties.vector) {
      console.log('   Inferred Vector:', conclusion.properties.vector);
    }
    console.log('Valid?', isValid);
    console.log('========================\n');

    return new Question({
      network,
      premises,
      conclusion,
      isValid,
      metadata: {
        premiseCount: premises.length,
        entityCount: entities.length,
        relationTypes: [relationType.name],
        isMixed: false,
        level: 0
      }
    });
  }

  /**
   * Create a path with consistent vocabulary
   */
  createPath(entities, relationType) {
    let pathProperties;
    let vocabulary;

    if (relationType instanceof LinearRelationType) {
      // Pick dimension
      const dimensions = this.config.linearDimensions || ['size', 'speed', 'brightness'];
      const dimension = this.random.pickRandom(dimensions);

      // Pick vocabulary ONCE for this path
      const vocab = LINEAR_VOCABULARIES[dimension] || LINEAR_VOCABULARIES.size;
      vocabulary = {
        forward: this.random.pickRandom(vocab.forward),  // e.g., "is less than"
        backward: this.random.pickRandom(vocab.backward), // e.g., "is more than"
        equal: this.random.pickRandom(vocab.equal)
      };

      pathProperties = {
        dimension
      };

    } else if (relationType instanceof SpatialRelationType) {
      // Use grid-based positioning for spatial relations
      const spatialGrid = new SpatialGrid();
      spatialGrid.placeEntitiesRandomly(entities);

      // Pick vocabulary style ONCE for consistency
      const vocabStyle = this.random.pickRandom(['cardinal', 'relative']);
      const vocabSet = SPATIAL_VOCABULARIES[2][vocabStyle];

      vocabulary = {
        vocabSet: vocabSet,
        style: vocabStyle
      };

      pathProperties = {
        vocabStyle,
        spatialGrid: spatialGrid, // Store the grid for calculating vectors
        edgeVectors: [] // Will be filled based on grid positions
      };

      // Log grid for debugging
      console.log('Spatial Grid:', spatialGrid.toString());
      console.log('Entity Positions:', spatialGrid.getDebugInfo());

    } else if (relationType instanceof CategoricalRelationType) {
      // Pick vocabulary ONCE
      vocabulary = {
        forward: this.random.pickRandom(CATEGORICAL_VOCABULARIES.same),
        backward: this.random.pickRandom(CATEGORICAL_VOCABULARIES.different),
        equal: this.random.pickRandom(CATEGORICAL_VOCABULARIES.same)
      };

      const same = this.random.coinFlip();
      pathProperties = {
        same
      };
    }

    return new Path({
      entities,
      relationType,
      pathProperties,
      vocabulary
    });
  }

  /**
   * Create an invalid conclusion by swapping the entities
   * This maintains the same vocabulary but makes it logically wrong
   */
  createInvalidConclusion(path, validConclusion) {
    // Valid: "A is less than C" (direction: 1) or "C is more than A" (direction: -1)
    // Invalid: Swap to make it wrong
    // If valid is "A is less than C", invalid is "C is less than A" (using same word "less")
    // If valid is "C is more than A", invalid is "A is more than C" (using same word "more")

    return path.createRelation(
      validConclusion.entities[1],     // Swap
      validConclusion.entities[0],     // Swap
      validConclusion.properties.text, // Keep same text (makes it wrong)
      validConclusion.properties.direction // Keep same direction semantically
    );
  }
}
