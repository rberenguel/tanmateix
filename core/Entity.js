/**
 * Entity represents a logical object in the premise network.
 * Entities are immutable once created.
 */
export class Entity {
  /**
   * @param {string} id - Unique identifier
   * @param {string} displayValue - What gets shown to the user
   */
  constructor(id, displayValue) {
    this.id = id;
    this.displayValue = displayValue;
    Object.freeze(this);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      displayValue: this.displayValue
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data) {
    return new Entity(data.id, data.displayValue);
  }
}
