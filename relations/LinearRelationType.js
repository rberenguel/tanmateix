import { RelationType } from '../core/RelationType.js';
import { Relation } from '../core/Relation.js';

/**
 * LinearRelationType handles all ordered comparisons (size, speed, brightness, etc.)
 * The logical behavior is identical across all dimensions; only vocabulary differs.
 *
 * Properties:
 * - direction: -1 (backward), 0 (equal), 1 (forward)
 * - dimension: 'size' | 'speed' | 'brightness' | 'temperature' | etc.
 */
export class LinearRelationType extends RelationType {
  constructor() {
    super('Linear');
  }

  /**
   * Create a linear relation
   * @param {Entity[]} entities - [from, to]
   * @param {Object} properties - { direction: -1|0|1, dimension: string }
   */
  createRelation(entities, properties) {
    return new Relation(this, entities, properties);
  }

  /**
   * Validate relation
   */
  validate(relation) {
    return relation.entities.length === 2 &&
           typeof relation.properties.direction === 'number' &&
           [-1, 0, 1].includes(relation.properties.direction) &&
           typeof relation.properties.dimension === 'string';
  }

  /**
   * Get inverse relation (swap entities and negate direction)
   */
  inverse(relation) {
    const newProps = {
      ...relation.properties,
      direction: -relation.properties.direction
    };
    return new Relation(
      this,
      [relation.entities[1], relation.entities[0]],
      newProps
    );
  }

  /**
   * Check contradiction
   * Only contradict if same entities AND same dimension AND different direction
   * Different relation types don't contradict
   */
  contradicts(rel1, rel2) {
    // Different relation types don't contradict - they're different aspects
    if (rel1.type.name !== rel2.type.name) {
      return false;
    }

    if (this.sameEntities(rel1, rel2) && this.sameDimension(rel1, rel2)) {
      return rel1.properties.direction !== rel2.properties.direction;
    }
    return false;
  }

  /**
   * Infer transitive relations
   * A > B, B > C => A > C (only within same dimension)
   */
  infer(relations) {
    const inferred = [];

    for (let i = 0; i < relations.length; i++) {
      for (let j = 0; j < relations.length; j++) {
        if (i === j) continue;

        const r1 = relations[i];
        const r2 = relations[j];

        // Must be same dimension for transitivity
        if (!this.sameDimension(r1, r2)) continue;

        // Check if r1.end === r2.start (chainable)
        if (r1.entities[1].id === r2.entities[0].id) {
          if (r1.properties.direction === r2.properties.direction &&
              r1.properties.direction !== 0) {
            inferred.push(this.createRelation(
              [r1.entities[0], r2.entities[1]],
              {
                direction: r1.properties.direction,
                dimension: r1.properties.dimension
              }
            ));
          }
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

  /**
   * Check if two relations are in the same dimension
   */
  sameDimension(rel1, rel2) {
    return rel1.properties.dimension === rel2.properties.dimension;
  }
}
