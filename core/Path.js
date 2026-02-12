/**
 * Path - represents one consistent logical path through an entity graph
 *
 * A path maintains 100% consistency in:
 * - Relationship type (Linear/Spatial/Categorical)
 * - Dimension (for Linear: size, speed, etc.)
 * - Vocabulary (specific words chosen once)
 *
 * Example path:
 *   Entities: [A, B, C]
 *   Type: Linear
 *   Dimension: size
 *   Vocabulary: {forward: "is larger than", backward: "is smaller than"}
 *   Relations: A is larger than B, B is larger than C
 *   Inference: A is larger than C
 */
export class Path {
  /**
   * @param {Object} config
   * @param {Entity[]} config.entities - Entities in path order [A, B, C, ...]
   * @param {RelationType} config.relationType - The type of relation
   * @param {Object} config.pathProperties - Type-specific properties
   * @param {Object} config.vocabulary - The chosen vocabulary {forward, backward, equal}
   */
  constructor(config) {
    this.entities = config.entities;
    this.relationType = config.relationType;
    this.pathProperties = config.pathProperties; // dimension, vocabStyle, etc.
    this.vocabulary = config.vocabulary; // The actual text to use

    // Generate all relations in this path
    this.relations = this.generateRelations();
  }

  /**
   * Generate all relations along this path
   * Linear: Entities have logical ordering, we vary phrasing
   * Spatial: Entities have fixed positions, no swapping
   * Categorical: Each edge can independently be "same" or "different"
   */
  generateRelations() {
    const relations = [];
    const isSpatial = this.relationType.name === "Spatial";
    const isCategorical = this.relationType.name === "Categorical";

    // For linear: force variety in 2-premise questions
    // First edge gets random phrasing, second gets opposite
    let firstEdgePhrasing = null;
    const totalEdges = this.entities.length - 1;

    // For each consecutive pair in the ordering
    for (let i = 0; i < this.entities.length - 1; i++) {
      const entityA = this.entities[i];
      const entityB = this.entities[i + 1];

      if (isSpatial) {
        // Spatial: Calculate actual vector from grid positions
        const spatialGrid = this.pathProperties.spatialGrid;
        const vector = spatialGrid.getVector(entityA, entityB);
        const vectorKey = JSON.stringify(vector);

        // Get text from vocab set for this specific vector
        const vocabSet = this.vocabulary.vocabSet;
        const text = vocabSet[vectorKey]
          ? vocabSet[vectorKey][0]
          : "relates to";

        // Store vector for this edge
        this.pathProperties.edgeVectors.push(vector);

        // Create relation: "B is [direction] of A" (entityB relative to entityA)
        const relation = this.createRelationWithVector(
          entityB,
          entityA,
          text,
          vector,
        );
        relations.push(relation);
      } else if (isCategorical) {
        // Categorical: Randomly pick "same" or "different" for each edge
        const useSame = Math.random() < 0.5;
        const text = useSame
          ? this.vocabulary.forward
          : this.vocabulary.backward;
        const relation = this.createRelation(
          entityA,
          entityB,
          text,
          useSame ? 1 : -1,
        );
        relations.push(relation);
      } else {
        // Linear: Vary phrasing to avoid repetition
        let useForwardPhrasing;

        if (totalEdges === 2) {
          // For 2-premise questions: force different phrasings
          if (i === 0) {
            // First edge: pick randomly
            useForwardPhrasing = Math.random() < 0.5;
            firstEdgePhrasing = useForwardPhrasing;
          } else {
            // Second edge: use opposite of first
            useForwardPhrasing = !firstEdgePhrasing;
          }
        } else {
          // For more premises: random each time
          useForwardPhrasing = Math.random() < 0.5;
        }

        let relation;
        if (useForwardPhrasing) {
          // Forward: "A is less than B" (A < B in logical order)
          relation = this.createRelation(
            entityA,
            entityB,
            this.vocabulary.forward,
            1,
          );
        } else {
          // Backward: "B is more than A" (same logical relationship, entities swapped)
          relation = this.createRelation(
            entityB,
            entityA,
            this.vocabulary.backward,
            -1,
          );
        }

        relations.push(relation);
      }
    }

    return relations;
  }

  /**
   * Create a single relation with stored text and semantic properties
   */
  createRelation(fromEntity, toEntity, text, direction = 1) {
    // Create relation with semantic properties (for validation) AND text (for rendering)
    const properties = {
      ...this.pathProperties,
      direction: direction, // Semantic property for validation
      text: text, // Actual text for rendering
    };

    return this.relationType.createRelation([fromEntity, toEntity], properties);
  }

  /**
   * Get the inferred relation (first to last entity in logical ordering)
   */
  getInferredRelation() {
    if (this.entities.length < 3) {
      return null;
    }

    const isSpatial = this.relationType.name === "Spatial";

    if (isSpatial) {
      // Spatial: Sum all edge vectors to get inferred vector
      const edgeVectors = this.pathProperties.edgeVectors;
      const sumVector = edgeVectors.reduce(
        (acc, vec) => {
          return acc.map((v, i) => v + vec[i]);
        },
        [0, 0],
      );

      // Normalize the result
      const inferredVector = this.normalize(sumVector);
      const vectorKey = JSON.stringify(inferredVector);

      // Get text for inferred vector
      const vocabSet = this.vocabulary.vocabSet;
      const text = vocabSet[vectorKey] ? vocabSet[vectorKey][0] : "relates to";

      // "C is [direction] of A"
      return this.createRelationWithVector(
        this.entities[this.entities.length - 1],
        this.entities[0],
        text,
        inferredVector,
      );
    } else {
      // Linear: Can phrase either way (randomly chosen)
      const useForwardPhrasing = Math.random() < 0.5;

      if (useForwardPhrasing) {
        // "A is less than C" (direction: 1 = forward)
        return this.createRelation(
          this.entities[0],
          this.entities[this.entities.length - 1],
          this.vocabulary.forward,
          1,
        );
      } else {
        // "C is more than A" (direction: -1 = backward)
        return this.createRelation(
          this.entities[this.entities.length - 1],
          this.entities[0],
          this.vocabulary.backward,
          -1,
        );
      }
    }
  }

  /**
   * Get all premises (direct relations in the path)
   */
  getPremises() {
    return this.relations;
  }

  /**
   * Generate random normalized vector
   */
  randomVector(dimensions) {
    const vector = new Array(dimensions).fill(0);
    const nonZeroDim = Math.floor(Math.random() * dimensions);
    vector[nonZeroDim] = Math.random() < 0.5 ? -1 : 1;
    return vector;
  }

  /**
   * Create relation with vector (for spatial)
   */
  createRelationWithVector(fromEntity, toEntity, text, vector) {
    const properties = {
      ...this.pathProperties,
      text: text,
      vector: vector,
      direction: 1, // For validation
    };

    return this.relationType.createRelation([fromEntity, toEntity], properties);
  }

  /**
   * Normalize vector
   */
  normalize(vector) {
    return vector.map((v) => {
      if (v === 0) return 0;
      return v / Math.abs(v);
    });
  }
}
