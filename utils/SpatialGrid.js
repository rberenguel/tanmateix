/**
 * SpatialGrid - Concrete 3x3 grid for placing entities in 2D space
 *
 * Places entities at actual positions on a grid and calculates
 * real spatial relationships between them.
 *
 * Grid layout:
 * [0,2] [1,2] [2,2]    [NW] [N] [NE]
 * [0,1] [1,1] [2,1]    [W]  [C] [E]
 * [0,0] [1,0] [2,0]    [SW] [S] [SE]
 */
export class SpatialGrid {
  constructor() {
    this.grid = Array(3).fill(null).map(() => Array(3).fill(null));
    this.centerPosition = [1, 1]; // Center of grid
    this.entityPositions = new Map(); // entity.id -> [x, y]
  }

  /**
   * Place an entity at a specific grid position
   */
  placeEntity(entity, position) {
    const [x, y] = position;

    if (x < 0 || x > 2 || y < 0 || y > 2) {
      throw new Error(`Invalid position: [${x}, ${y}]. Must be 0-2.`);
    }

    if (this.grid[y][x] !== null) {
      throw new Error(`Position [${x}, ${y}] is already occupied.`);
    }

    this.grid[y][x] = entity;
    this.entityPositions.set(entity.id, position);
  }

  /**
   * Place entities randomly on the grid
   * First entity always goes in center [1,1]
   * Other entities go in random available positions
   */
  placeEntitiesRandomly(entities) {
    if (entities.length > 9) {
      throw new Error('Cannot place more than 9 entities on 3x3 grid');
    }

    // Place first entity in center for clarity
    this.placeEntity(entities[0], this.centerPosition);

    // Get all available positions (excluding center)
    const availablePositions = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (x === 1 && y === 1) continue; // Skip center
        availablePositions.push([x, y]);
      }
    }

    // Shuffle available positions
    this.shuffleArray(availablePositions);

    // Place remaining entities
    for (let i = 1; i < entities.length; i++) {
      const position = availablePositions.pop();
      this.placeEntity(entities[i], position);
    }
  }

  /**
   * Get the spatial vector from one entity to another
   * Returns normalized vector [-1, 0, 1] in each dimension
   */
  getVector(fromEntity, toEntity) {
    const fromPos = this.entityPositions.get(fromEntity.id);
    const toPos = this.entityPositions.get(toEntity.id);

    if (!fromPos || !toPos) {
      throw new Error('Entity not found in grid');
    }

    // Calculate raw vector (difference in positions)
    const rawVector = [
      toPos[0] - fromPos[0], // x difference
      toPos[1] - fromPos[1]  // y difference
    ];

    // Normalize to [-1, 0, 1]
    return this.normalize(rawVector);
  }

  /**
   * Get the position of an entity
   */
  getPosition(entity) {
    return this.entityPositions.get(entity.id);
  }

  /**
   * Normalize a vector to [-1, 0, 1] in each dimension
   */
  normalize(vector) {
    return vector.map(v => {
      if (v === 0) return 0;
      return v / Math.abs(v);
    });
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Get a visual representation of the grid (for debugging)
   */
  toString() {
    let result = 'Grid (y increases upward):\n';
    for (let y = 2; y >= 0; y--) {
      const row = [];
      for (let x = 0; x < 3; x++) {
        const entity = this.grid[y][x];
        if (entity) {
          row.push(entity.displayValue.substring(0, 5).padEnd(5));
        } else {
          row.push('  .  ');
        }
      }
      result += row.join(' ') + '\n';
    }
    return result;
  }

  /**
   * Get debug info about entity positions
   */
  getDebugInfo() {
    const info = {};
    for (const [entityId, position] of this.entityPositions.entries()) {
      info[entityId] = position;
    }
    return info;
  }
}
