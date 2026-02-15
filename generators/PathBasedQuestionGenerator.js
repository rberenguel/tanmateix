import { Path } from "../core/Path.js";
import { Question } from "../models/Question.js";
import { LinearRelationType } from "../relations/LinearRelationType.js";
import { SpatialRelationType } from "../relations/SpatialRelationType.js";
import { CategoricalRelationType } from "../relations/CategoricalRelationType.js";
import { PremiseNetwork } from "../core/PremiseNetwork.js";
import {
  LINEAR_VOCABULARIES,
  SPATIAL_VOCABULARIES,
  CATEGORICAL_VOCABULARIES,
} from "../render/Vocabulary.js";
import { SpatialGrid } from "../utils/SpatialGrid.js";
import { QuestionVerifier } from "../verification/QuestionVerifier.js";

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
    this.verifier = new QuestionVerifier();
  }

  /**
   * Generate a multi-path question with configurable number of paths
   * @param {number} numPaths - Number of paths to generate (default: 1)
   * @param {number} entitiesPerPath - Number of entities per path (default: 3)
   * Each path creates (entitiesPerPath - 1) premises over the SAME entities
   */
  async generateMultiPathQuestion(numPaths = 1, entitiesPerPath = 3) {
    // All paths share the same entity graph
    const entities = this.entityFactory.createEntities(entitiesPerPath);

    // Create paths - all using the same 3 entities
    const paths = [];
    const allPremises = [];
    const network = new PremiseNetwork();
    entities.forEach((e) => network.addEntity(e));

    // Available relation types
    const availableRelationTypes = [
      new LinearRelationType(),
      new SpatialRelationType(2),
      // Categorical disabled - not interesting enough
      // new CategoricalRelationType(),
    ];

    // Track used relation types to avoid duplicates
    const usedTypes = new Set();

    for (let i = 0; i < numPaths; i++) {
      // All paths use the same entities: [A, B, C]
      const pathEntities = entities;

      // Pick a unique relationship type for this path if possible
      let relationType;
      if (usedTypes.size < availableRelationTypes.length) {
        // Pick from unused types
        const unusedTypes = availableRelationTypes.filter(
          (rt) => !usedTypes.has(rt.name),
        );
        relationType = this.random.pickRandom(unusedTypes);
      } else {
        // All types used, create new instances
        relationType = this.random.pickRandom(
          availableRelationTypes.map((rt) => {
            if (rt instanceof LinearRelationType)
              return new LinearRelationType();
            if (rt instanceof SpatialRelationType)
              return new SpatialRelationType(2);
            if (rt instanceof CategoricalRelationType)
              return new CategoricalRelationType();
          }),
        );
      }

      usedTypes.add(relationType.name);

      // Generate path
      const path = this.createPath(pathEntities, relationType);
      paths.push(path);

      // Add relations to network
      path.getPremises().forEach((r) => network.addRelation(r));
      allPremises.push(...path.getPremises());
    }

    // Shuffle premises to mix different relation types (makes it harder)
    const shuffledPremises = this.random.shuffle(allPremises);

    // Pick one path for the conclusion
    const conclusionPath = this.random.pickRandom(paths);
    const inferredRelation = conclusionPath.getInferredRelation();

    // Safety check: if no valid inference (shouldn't happen with fixed categorical generation)
    if (!inferredRelation) {
      throw new Error(
        `Cannot infer conclusion from ${conclusionPath.relationType.name} path - this indicates a bug in path generation`,
      );
    }

    // Randomly decide if valid or invalid
    const isValid = this.random.coinFlip();
    let conclusion;

    if (isValid) {
      conclusion = inferredRelation;
    } else {
      conclusion = this.createInvalidConclusion(
        conclusionPath,
        inferredRelation,
      );
    }

    // DEBUG LOGGING
    console.log("=== GENERATED MULTI-PATH QUESTION ===");
    console.log("Number of paths:", numPaths);
    console.log("Number of entities:", entities.length);
    console.log("Total premises:", allPremises.length);
    console.log(
      "Entities:",
      entities.map((e) => e.displayValue),
    );

    paths.forEach((path, idx) => {
      console.log(`\nPath ${idx + 1}:`);
      console.log("  Relation Type:", path.relationType.name);
      console.log(
        "  Entities:",
        path.entities.map((e) => e.displayValue),
      );
      console.log("  Vocabulary:", path.vocabulary);
      if (path.relationType.name === "Spatial") {
        console.log("  Grid Layout:");
        console.log(path.pathProperties.spatialGrid.toString());
        console.log("  Edge Vectors:", path.pathProperties.edgeVectors);
      }
      console.log("  Premises:");
      path.getPremises().forEach((p, i) => {
        console.log(
          `    ${i + 1}. ${p.entities[0].displayValue} [${p.properties.text}] ${p.entities[1].displayValue}`,
        );
        if (p.properties.vector) {
          console.log(`       Vector:`, p.properties.vector);
        }
      });
    });

    console.log(
      "\nConclusion:",
      `${conclusion.entities[0].displayValue} [${conclusion.properties.text}] ${conclusion.entities[1].displayValue}`,
    );
    if (conclusion.properties.vector) {
      console.log("   Inferred Vector:", conclusion.properties.vector);
    }
    console.log("Valid?", isValid);
    console.log("========================\n");

    // Get spatial grid if any spatial path exists
    const spatialPath = paths.find((p) => p.relationType.name === "Spatial");

    const question = new Question({
      network,
      premises: shuffledPremises,
      conclusion,
      isValid,
      metadata: {
        premiseCount: allPremises.length,
        entityCount: entities.length,
        relationTypes: paths.map((p) => p.relationType.name),
        isMixed:
          paths.length > 1 &&
          new Set(paths.map((p) => p.relationType.name)).size > 1,
        level: numPaths > 1 ? numPaths : 0,
        numPaths: numPaths,
        spatialGrid: spatialPath?.pathProperties.spatialGrid,
      },
    });

    // Verify question logic for all relation types
    const relationType = conclusionPath.relationType.name;
    let verificationQuestion = question;
    let spatialGrid = null;

    // For multi-path questions with mixed types, extract only premises matching the conclusion type
    if (
      paths.length > 1 &&
      new Set(paths.map((p) => p.relationType.name)).size > 1
    ) {
      const relevantPremises = allPremises.filter(
        (p) => p.type.name === relationType,
      );
      const relevantNetwork = new PremiseNetwork();
      entities.forEach((e) => relevantNetwork.addEntity(e));
      relevantPremises.forEach((r) => relevantNetwork.addRelation(r));

      verificationQuestion = new Question({
        network: relevantNetwork,
        premises: relevantPremises,
        conclusion: conclusion,
        isValid: question.isValid,
        metadata: question.metadata,
      });
    }

    // Get spatial grid if needed
    if (relationType === "Spatial") {
      const spatialPath = paths.find((p) => p.relationType.name === "Spatial");
      spatialGrid = spatialPath.pathProperties.spatialGrid;
    }

    // Verify the question
    const verification = await this.verifier.verifyQuestion(
      verificationQuestion,
      spatialGrid,
    );

    if (!verification.valid) {
      console.error(
        `❌ ${relationType.toUpperCase()} VERIFICATION FAILED:`,
        verification.error,
      );
      console.error("This indicates a bug in question generation!");
      console.error("Details:", verification.details);

      if (typeof window !== "undefined" && window.showVerificationError) {
        window.showVerificationError(verification.error);
      }
    } else if (verification.warning) {
      console.warn(`⚠️  ${relationType} verification:`, verification.warning);
    } else {
      console.log(`✓ ${relationType} question verified`);
    }

    return question;
  }

  /**
   * Generate a level 0 question: 2 premises, 1 path, 3 entities
   */
  async generateLevel0Question() {
    return await this.generateMultiPathQuestion(1);
  }

  /**
   * Create a path with consistent vocabulary
   */
  createPath(entities, relationType) {
    let pathProperties;
    let vocabulary;

    if (relationType instanceof LinearRelationType) {
      // Pick dimension
      const dimensions = this.config.linearDimensions || [
        "size",
        "speed",
        "brightness",
      ];
      const dimension = this.random.pickRandom(dimensions);

      // Pick vocabulary ONCE for this path
      const vocab = LINEAR_VOCABULARIES[dimension] || LINEAR_VOCABULARIES.size;
      vocabulary = {
        forward: this.random.pickRandom(vocab.forward), // e.g., "is less than"
        backward: this.random.pickRandom(vocab.backward), // e.g., "is more than"
        equal: this.random.pickRandom(vocab.equal),
      };

      pathProperties = {
        dimension,
      };
    } else if (relationType instanceof SpatialRelationType) {
      // Use grid-based positioning for spatial relations
      const spatialGrid = new SpatialGrid();
      spatialGrid.placeEntitiesRandomly(entities);

      // Pick vocabulary style ONCE for consistency
      const vocabStyle = this.random.pickRandom(["cardinal", "relative"]);
      const vocabSet = SPATIAL_VOCABULARIES[2][vocabStyle];

      vocabulary = {
        vocabSet: vocabSet,
        style: vocabStyle,
      };

      pathProperties = {
        vocabStyle,
        spatialGrid: spatialGrid, // Store the grid for calculating vectors
        edgeVectors: [], // Will be filled based on grid positions
      };

      // Log grid for debugging
      console.log("Spatial Grid:", spatialGrid.toString());
      console.log("Entity Positions:", spatialGrid.getDebugInfo());
    } else if (relationType instanceof CategoricalRelationType) {
      // Pick vocabulary ONCE
      vocabulary = {
        forward: this.random.pickRandom(CATEGORICAL_VOCABULARIES.same),
        backward: this.random.pickRandom(CATEGORICAL_VOCABULARIES.different),
        equal: this.random.pickRandom(CATEGORICAL_VOCABULARIES.same),
      };

      const same = this.random.coinFlip();
      pathProperties = {
        same,
      };
    }

    return new Path({
      entities,
      relationType,
      pathProperties,
      vocabulary,
    });
  }

  /**
   * Generate a fully-connected spatial graph question
   * @param {number} numEntities - Number of entities (default: 3)
   * Creates all pairwise spatial relations (or a subset)
   */
  async generateSpatialGraphQuestion(numEntities = 3, _retryCount = 0) {
    const entities = this.entityFactory.createEntities(numEntities);
    const relationType = new SpatialRelationType(2);

    // Create spatial grid and place all entities
    const spatialGrid = new SpatialGrid();
    spatialGrid.placeEntitiesRandomly(entities);

    // Pick vocabulary style
    const vocabStyle = this.random.pickRandom(["cardinal", "relative"]);
    const vocabSet = SPATIAL_VOCABULARIES[2][vocabStyle];

    const vocabulary = {
      vocabSet: vocabSet,
      style: vocabStyle,
    };

    // Generate all pairwise relations (only one direction per pair)
    const premises = [];
    const network = new PremiseNetwork();
    entities.forEach((e) => network.addEntity(e));

    // Create relations for all pairs (only i < j to avoid duplicates/contradictions)
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i];
        const entityB = entities[j];

        const vector = spatialGrid.getVector(entityA, entityB);
        // Normalize for vocabulary lookup (vocabSet keys are normalized)
        const normalizedVector = vector.map((v) =>
          v === 0 ? 0 : v / Math.abs(v),
        );
        const vectorKey = JSON.stringify(normalizedVector);
        const text = vocabSet[vectorKey]
          ? vocabSet[vectorKey][0]
          : "relates to";

        const relation = relationType.createRelation([entityB, entityA], {
          text,
          vector,
          vocabStyle,
        });

        premises.push(relation);
        network.addRelation(relation);
      }
    }

    // Shuffle to make it harder
    const shuffledPremises = this.random.shuffle(premises);

    // Pick a random subset of premises to show (not all of them)
    const numPremisesToShow = Math.min(
      (numEntities * (numEntities - 1)) / 2, // At most half (undirected pairs)
      shuffledPremises.length,
    );
    const shownPremises = shuffledPremises.slice(0, numPremisesToShow);

    // Pick two random entities for conclusion
    const [e1, e2] = this.random.shuffle([...entities]).slice(0, 2);
    const conclusionVector = spatialGrid.getVector(e1, e2);
    const conclusionVectorKey = JSON.stringify(conclusionVector);
    const conclusionText = vocabSet[conclusionVectorKey]
      ? vocabSet[conclusionVectorKey][0]
      : "relates to";

    // Randomly decide if valid or invalid
    const isValid = this.random.coinFlip();
    let conclusion;

    if (isValid) {
      conclusion = relationType.createRelation([e2, e1], {
        text: conclusionText,
        vector: conclusionVector,
        vocabStyle,
      });
    } else {
      // Invalid: use wrong vector
      const wrongVector = conclusionVector.map((v) => -v); // Flip direction
      const wrongVectorKey = JSON.stringify(wrongVector);
      const wrongText = vocabSet[wrongVectorKey]
        ? vocabSet[wrongVectorKey][0]
        : "relates to";
      conclusion = relationType.createRelation([e2, e1], {
        text: wrongText,
        vector: wrongVector,
        vocabStyle,
      });
    }

    console.log("=== SPATIAL GRAPH QUESTION ===");
    console.log("Grid Layout:");
    console.log(spatialGrid.toString());
    console.log("Shown premises:", shownPremises.length, "/", premises.length);
    console.log("Valid?", isValid);

    const question = new Question({
      network,
      premises: shownPremises,
      conclusion,
      isValid,
      metadata: {
        premiseCount: shownPremises.length,
        entityCount: entities.length,
        relationTypes: ["Spatial"],
        isMixed: false,
        level: "spatial-graph",
        graphType: "fully-connected",
        spatialGrid: spatialGrid, // Include grid for verification
      },
    });

    // Verify question with Prolog
    const verification = await this.verifier.verifyQuestion(
      question,
      spatialGrid,
    );
    if (!verification.valid) {
      console.error("❌ SPATIAL VERIFICATION FAILED:", verification.error);
      console.error("Question details:", verification.details);
      console.error("This indicates a bug in spatial question generation!");

      // Show modal in browser
      if (typeof window !== "undefined" && window.showVerificationError) {
        window.showVerificationError(verification.error);
      } else if (typeof window === "undefined") {
        // Node.js: throw error
        throw new Error("Spatial verification failed: " + verification.error);
      }

      // Regenerate a new question (with retry limit to prevent infinite loop)
      if (_retryCount < 10) {
        return this.generateSpatialGraphQuestion(numEntities, _retryCount + 1);
      } else {
        // After 10 retries, just return the invalid question with a warning
        console.error(
          "⚠️  Could not generate valid spatial question after 10 retries",
        );
        return question;
      }
    } else if (verification.warning) {
      console.warn("⚠️  Spatial verification:", verification.warning);
    } else {
      console.log("✓ Spatial question verified");
    }
    console.log("========================\n");

    return question;
  }

  /**
   * Create an invalid conclusion by swapping the entities or flipping the relation
   * This maintains the same vocabulary but makes it logically wrong
   */
  createInvalidConclusion(path, validConclusion) {
    const isCategorical = path.relationType.name === "Categorical";
    const isSpatial = path.relationType.name === "Spatial";

    if (isCategorical) {
      // Categorical: Flip the relation (same ↔ different)
      // Can't just swap entities because "same" is symmetric
      const newDirection = -validConclusion.properties.direction;
      const newText =
        newDirection === 1 ? path.vocabulary.forward : path.vocabulary.backward;

      return path.createRelation(
        validConclusion.entities[0],
        validConclusion.entities[1],
        newText,
        newDirection,
      );
    } else if (isSpatial) {
      // Spatial: Flip the vector to make it wrong
      // If valid is "A is north of B" (vector [0,1]), invalid is "A is south of B" (vector [0,-1])
      const flippedVector = validConclusion.properties.vector.map((v) => -v);
      const normalizedVector = flippedVector.map((v) =>
        v === 0 ? 0 : v / Math.abs(v),
      );
      const vectorKey = JSON.stringify(normalizedVector);

      // Get text for flipped vector
      const vocabSet = path.vocabulary.vocabSet;
      const flippedText = vocabSet[vectorKey]
        ? vocabSet[vectorKey][0]
        : validConclusion.properties.text;

      return path.createRelationWithVector(
        validConclusion.entities[0],
        validConclusion.entities[1],
        flippedText,
        flippedVector,
      );
    } else {
      // Linear: Swap entities to make it wrong
      // Valid: "A is less than C" (direction: 1) or "C is more than A" (direction: -1)
      // Invalid: Swap to make it wrong
      // If valid is "A is less than C", invalid is "C is less than A" (using same word "less")
      // If valid is "C is more than A", invalid is "A is more than C" (using same word "more")

      return path.createRelation(
        validConclusion.entities[1], // Swap
        validConclusion.entities[0], // Swap
        validConclusion.properties.text, // Keep same text (makes it wrong)
        validConclusion.properties.direction, // Keep same direction semantically
      );
    }
  }
}
