import { LinearRelationType } from "../relations/LinearRelationType.js";
import { SpatialRelationType } from "../relations/SpatialRelationType.js";
import { CategoricalRelationType } from "../relations/CategoricalRelationType.js";

/**
 * ConclusionGenerator generates valid and invalid conclusions from a premise network.
 */
export class ConclusionGenerator {
  /**
   * @param {RandomUtils} random
   */
  constructor(random) {
    this.random = random;
  }

  /**
   * Generate a conclusion question
   *
   * @param {PremiseNetwork} network
   * @param {Object} options
   * @param {boolean} options.valid - Whether to generate valid or invalid conclusion
   * @param {RelationType} options.relationType - Type of relation for conclusion (or null for any)
   * @param {string} options.strategy - 'direct' | 'inferred' | 'unrelated' | 'random'
   * @param {boolean} options.inferredOnly - Only use inferred relations (no existing premises)
   * @returns {Object} { relation: Relation, isValid: boolean, strategy: string }
   */
  generateConclusion(network, options = {}) {
    const {
      valid = this.random.coinFlip(),
      relationType = null,
      strategy = "random",
      inferredOnly = false,
    } = options;

    if (valid) {
      return this.generateValidConclusion(
        network,
        relationType,
        strategy,
        inferredOnly,
      );
    } else {
      return this.generateInvalidConclusion(network, relationType, strategy);
    }
  }

  /**
   * Generate a valid conclusion
   */
  generateValidConclusion(
    network,
    relationType,
    strategy,
    inferredOnly = false,
  ) {
    let relation;

    // If inferredOnly, force strategy to be 'inferred'
    if (inferredOnly) {
      strategy = "inferred";
    }

    if (
      strategy === "direct" ||
      (strategy === "random" && this.random.random() < 0.5)
    ) {
      // Pick an existing relation
      let candidates = network.relations;
      if (relationType) {
        candidates = network.getRelationsByType(relationType);
      }

      if (candidates.length === 0) {
        return this.generateValidConclusion(
          network,
          relationType,
          "inferred",
          inferredOnly,
        );
      }

      relation = this.random.pickRandom(candidates);
    } else {
      // Generate inferred relation
      const inferred = network.inferRelations();
      let candidates = inferred;
      if (relationType) {
        candidates = inferred.filter((r) => r.type === relationType);
      }

      // Filter out existing premises AND their inverses if inferredOnly is true
      if (inferredOnly) {
        candidates = candidates.filter(
          (inferredRel) =>
            !network.relations.some((existingRel) => {
              // Check if it's the same as existing premise (forward)
              const sameForward =
                existingRel.entities[0].id === inferredRel.entities[0].id &&
                existingRel.entities[1].id === inferredRel.entities[1].id &&
                existingRel.type === inferredRel.type;

              // Check if it's the inverse of existing premise (backward)
              const sameBackward =
                existingRel.entities[0].id === inferredRel.entities[1].id &&
                existingRel.entities[1].id === inferredRel.entities[0].id &&
                existingRel.type === inferredRel.type;

              return sameForward || sameBackward;
            }),
        );
      }

      if (candidates.length === 0) {
        // If no inferred relations available and inferredOnly is false, fall back to direct
        if (!inferredOnly) {
          return this.generateValidConclusion(
            network,
            relationType,
            "direct",
            inferredOnly,
          );
        }
        // If inferredOnly is true and no inferred relations, this is an error
        throw new Error("No inferred relations available for conclusion");
      }

      relation = this.random.pickRandom(candidates);
    }

    // Optionally reverse it (but not if inferredOnly, to avoid creating premise inverses)
    if (!inferredOnly && this.random.coinFlip()) {
      relation = relation.inverse();
    }

    return {
      relation,
      isValid: true,
      strategy: strategy === "random" ? "valid-mixed" : `valid-${strategy}`,
    };
  }

  /**
   * Generate an invalid conclusion
   */
  generateInvalidConclusion(network, relationType, strategy) {
    const strategies = ["contradict", "wrong-relation", "unrelated"];
    const chosenStrategy =
      strategy === "random" ? this.random.pickRandom(strategies) : strategy;

    switch (chosenStrategy) {
      case "contradict":
        return this.generateContradictingConclusion(network, relationType);

      case "wrong-relation":
        return this.generateWrongRelationConclusion(network, relationType);

      case "unrelated":
        return this.generateUnrelatedConclusion(network, relationType);

      default:
        return this.generateInvalidConclusion(network, relationType, "random");
    }
  }

  /**
   * Generate a contradicting conclusion (flip an existing relation)
   */
  generateContradictingConclusion(network, relationType) {
    let candidates = network.relations;
    if (relationType) {
      candidates = network.getRelationsByType(relationType);
    }

    if (candidates.length === 0) {
      return this.generateInvalidConclusion(
        network,
        relationType,
        "wrong-relation",
      );
    }

    const original = this.random.pickRandom(candidates);
    const contradicting = this.createContradiction(original);

    return {
      relation: contradicting,
      isValid: false,
      strategy: "invalid-contradict",
    };
  }

  /**
   * Create a contradiction of a relation
   */
  createContradiction(relation) {
    if (relation.type instanceof LinearRelationType) {
      const newProps = {
        ...relation.properties,
        direction: -relation.properties.direction,
      };
      return relation.type.createRelation(relation.entities, newProps);
    } else if (relation.type instanceof SpatialRelationType) {
      // Pick a different direction
      const wrongVector = this.randomDifferentVector(
        relation.properties.vector,
        relation.type.dimensions,
      );
      return relation.type.createRelation(relation.entities, {
        vector: wrongVector,
        vocabStyle: relation.properties.vocabStyle, // Preserve vocabulary style
      });
    } else if (relation.type instanceof CategoricalRelationType) {
      return relation.type.createRelation(relation.entities, {
        same: !relation.properties.same,
      });
    }

    throw new Error(`Cannot create contradiction for ${relation.type.name}`);
  }

  /**
   * Generate wrong relation conclusion
   */
  generateWrongRelationConclusion(network, relationType) {
    const entities = Array.from(network.entities.values());
    if (entities.length < 2) {
      return this.generateInvalidConclusion(network, relationType, "unrelated");
    }

    const [e1, e2] = this.random.pickRandomN(entities, 2);

    // Get actual relation if exists
    const actual = network.getRelationBetween(e1.id, e2.id);

    if (!actual) {
      return this.generateInvalidConclusion(network, relationType, "unrelated");
    }

    // Infer what it should be
    const inferred = network.inferRelations();
    const inferredActual = inferred.find(
      (r) =>
        (r.entities[0].id === e1.id && r.entities[1].id === e2.id) ||
        (r.entities[0].id === e2.id && r.entities[1].id === e1.id),
    );

    if (inferredActual) {
      const wrong = this.createContradiction(inferredActual);
      return {
        relation: wrong,
        isValid: false,
        strategy: "invalid-wrong-relation",
      };
    }

    return this.generateInvalidConclusion(network, relationType, "contradict");
  }

  /**
   * Generate conclusion about unrelated entities
   */
  generateUnrelatedConclusion(network, relationType) {
    const unrelated = network.getUnrelatedPairs();

    if (unrelated.length === 0) {
      return this.generateInvalidConclusion(
        network,
        relationType,
        "contradict",
      );
    }

    const [e1, e2] = this.random.pickRandom(unrelated);

    // Pick random relation type if not specified
    const type =
      relationType ||
      this.random.pickRandom(
        Array.from(new Set(network.relations.map((r) => r.type))),
      );

    // Create random relation
    let relation;
    if (type instanceof LinearRelationType) {
      // Get dimension from existing linear relations to maintain consistency
      const existingLinearRel = network.relations.find(
        (r) => r.type instanceof LinearRelationType,
      );
      const dimension = existingLinearRel?.properties.dimension || "size";

      relation = type.createRelation([e1, e2], {
        direction: this.random.pickRandom([-1, 1]),
        dimension: dimension, // Use same dimension as premises
      });
    } else if (type instanceof SpatialRelationType) {
      // Get vocabStyle from existing spatial relations to maintain consistency
      const existingSpatialRel = network.relations.find(
        (r) => r.type instanceof SpatialRelationType,
      );
      const vocabStyle =
        existingSpatialRel?.properties.vocabStyle || "cardinal";

      relation = type.createRelation([e1, e2], {
        vector: this.random.randomVector(type.dimensions),
        vocabStyle: vocabStyle, // Preserve vocabulary style
      });
    } else if (type instanceof CategoricalRelationType) {
      relation = type.createRelation([e1, e2], {
        same: this.random.coinFlip(),
      });
    }

    return {
      relation,
      isValid: false,
      strategy: "invalid-unrelated",
    };
  }

  /**
   * Generate a different vector
   */
  randomDifferentVector(original, dimensions) {
    const candidates = [];

    // Generate all possible normalized vectors
    for (let i = 0; i < dimensions; i++) {
      for (const sign of [-1, 0, 1]) {
        const v = new Array(dimensions).fill(0);
        v[i] = sign;

        // Check if different from original
        if (!this.vectorsEqual(v, original)) {
          candidates.push(v);
        }
      }
    }

    if (candidates.length === 0) {
      // Fallback: return negated original
      return original.map((x) => -x);
    }

    return this.random.pickRandom(candidates);
  }

  /**
   * Check if two vectors are equal
   */
  vectorsEqual(v1, v2) {
    return v1.every((val, idx) => val === v2[idx]);
  }
}
