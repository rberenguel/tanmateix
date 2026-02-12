import { RelationType } from '../core/RelationType.js';
import { Relation } from '../core/Relation.js';

/**
 * CategoricalRelationType handles binary classification relationships.
 * Examples: same/different, identical/opposite
 *
 * Properties:
 * - same: boolean (true = same/identical, false = different/opposite)
 */
export class CategoricalRelationType extends RelationType {
  constructor() {
    super('Categorical');
  }

  /**
   * Create a categorical relation
   * @param {Entity[]} entities - [entity1, entity2]
   * @param {Object} properties - { same: boolean }
   */
  createRelation(entities, properties) {
    return new Relation(this, entities, properties);
  }

  /**
   * Validate relation
   */
  validate(relation) {
    return relation.entities.length === 2 &&
           typeof relation.properties.same === 'boolean';
  }

  /**
   * Get inverse relation
   * For categorical, inverse has same "sameness" (A=B is same as B=A)
   */
  inverse(relation) {
    return new Relation(
      this,
      [relation.entities[1], relation.entities[0]],
      { same: relation.properties.same }
    );
  }

  /**
   * Check contradiction
   * Same entities with different sameness = contradiction
   * Different relation types don't contradict
   */
  contradicts(rel1, rel2) {
    // Different relation types don't contradict - they're different aspects
    if (rel1.type.name !== rel2.type.name) {
      return false;
    }

    if (this.sameEntities(rel1, rel2)) {
      return rel1.properties.same !== rel2.properties.same;
    }
    return false;
  }

  /**
   * Infer transitive relations
   * A=B, B=C => A=C (both same)
   * A≠B, B=C => A≠C (XOR logic)
   */
  infer(relations) {
    const inferred = [];

    for (let i = 0; i < relations.length; i++) {
      for (let j = 0; j < relations.length; j++) {
        if (i === j) continue;

        const r1 = relations[i];
        const r2 = relations[j];

        // Check if chainable (r1.end === r2.start)
        if (r1.entities[1].id === r2.entities[0].id) {
          // XOR: result is same if both relations have same "sameness"
          const newSame = r1.properties.same === r2.properties.same;

          inferred.push(this.createRelation(
            [r1.entities[0], r2.entities[1]],
            { same: newSame }
          ));
        }
      }
    }

    return inferred;
  }

  /**
   * Check if two relations have same entities (in any order)
   */
  sameEntities(rel1, rel2) {
    return (rel1.entities[0].id === rel2.entities[0].id &&
            rel1.entities[1].id === rel2.entities[1].id) ||
           (rel1.entities[0].id === rel2.entities[1].id &&
            rel1.entities[1].id === rel2.entities[0].id);
  }
}
