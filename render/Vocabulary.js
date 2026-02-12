/**
 * Vocabulary registry - maps semantic properties to actual text
 * Completely separate from logic layer
 */

export const LINEAR_VOCABULARIES = {
  size: {
    forward: ["is larger than", "is bigger than", "exceeds"],
    backward: ["is smaller than", "is less than"],
    equal: ["is equal to", "is the same size as"],
    minimal: { forward: ">", backward: "<", equal: "=" },
  },
  speed: {
    forward: ["is faster than", "is quicker than", "outpaces"],
    backward: ["is slower than", "lags behind"],
    equal: ["has the same speed as", "matches the speed of"],
    minimal: { forward: ">>", backward: "<<", equal: "=" },
  },
  brightness: {
    forward: ["is brighter than", "is more luminous than"],
    backward: ["is dimmer than", "is less bright than"],
    equal: ["has the same brightness as"],
    minimal: { forward: "☀>", backward: "<☀", equal: "=" },
  },
  temperature: {
    forward: ["is hotter than", "is warmer than"],
    backward: ["is cooler than", "is colder than"],
    equal: ["has the same temperature as"],
    minimal: { forward: "🔥>", backward: "<🔥", equal: "=" },
  },
  weight: {
    forward: ["is heavier than", "weighs more than"],
    backward: ["is lighter than", "weighs less than"],
    equal: ["weighs the same as"],
    minimal: { forward: "⚖>", backward: "<⚖", equal: "=" },
  },
  height: {
    forward: ["is taller than"],
    backward: ["is shorter than"],
    equal: ["is the same height as"],
    minimal: { forward: "↑", backward: "↓", equal: "=" },
  },
  age: {
    forward: ["is older than", "is more aged than"],
    backward: ["is younger than", "is newer than"],
    equal: ["is the same age as"],
    minimal: { forward: "⏳>", backward: "<⏳", equal: "=" },
  },
  temporal: {
    forward: ["is before", "precedes", "comes before"],
    backward: ["is after", "follows", "comes after"],
    equal: ["is at the same time as", "occurs simultaneously with"],
    minimal: { forward: "→", backward: "←", equal: "=" },
  },
};

// Spatial vocabularies split by style for consistency within a question
export const SPATIAL_VOCABULARIES = {
  2: {
    cardinal: {
      // Cardinal directions (north, south, east, west)
      "[1,0]": ["is east of"],
      "[-1,0]": ["is west of"],
      "[0,1]": ["is north of"],
      "[0,-1]": ["is south of"],
      "[1,1]": ["is northeast of"],
      "[1,-1]": ["is southeast of"],
      "[-1,1]": ["is northwest of"],
      "[-1,-1]": ["is southwest of"],
      "[0,0]": ["is at the same location as"],
    },
    relative: {
      // Relative directions (left, right, above, below)
      "[1,0]": ["is to the right of"],
      "[-1,0]": ["is to the left of"],
      "[0,1]": ["is above"],
      "[0,-1]": ["is below"],
      "[1,1]": ["is to the upper-right of"],
      "[1,-1]": ["is to the lower-right of"],
      "[-1,1]": ["is to the upper-left of"],
      "[-1,-1]": ["is to the lower-left of"],
      "[0,0]": ["is at the same location as"],
    },
  },
  3: {
    cardinal: {
      "[0,0,1]": ["is higher than"],
      "[0,0,-1]": ["is lower than"],
      "[1,0,0]": ["is east of"],
      "[-1,0,0]": ["is west of"],
      "[0,1,0]": ["is north of"],
      "[0,-1,0]": ["is south of"],
    },
  },
  4: {
    cardinal: {
      "[0,0,0,1]": ["in the future"],
      "[0,0,0,-1]": ["in the past"],
    },
  },
};

export const CATEGORICAL_VOCABULARIES = {
  same: ["is the same as", "is identical to", "matches"],
  different: ["is different from", "is opposite of", "differs from"],
};

/**
 * Helper to pick random vocabulary
 */
export function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Pick a consistent vocabulary set for a linear dimension
 * Returns ONE choice for forward/backward/equal that will be used throughout
 */
export function pickLinearVocabulary(dimension) {
  const vocab = LINEAR_VOCABULARIES[dimension] || LINEAR_VOCABULARIES.size;

  return {
    forward: pickRandom(vocab.forward),
    backward: pickRandom(vocab.backward),
    equal: pickRandom(vocab.equal),
  };
}

/**
 * Pick a consistent vocabulary set for spatial relations
 * Returns a mapping of vectors to their text
 */
export function pickSpatialVocabulary(dimensions, style = "cardinal") {
  const vocab =
    SPATIAL_VOCABULARIES[dimensions]?.[style] ||
    SPATIAL_VOCABULARIES[2].cardinal;
  const chosen = {};

  // For each vector, pick one phrase
  for (const [vectorKey, phrases] of Object.entries(vocab)) {
    chosen[vectorKey] = pickRandom(phrases);
  }

  return chosen;
}

/**
 * Get text for linear relation
 */
export function getLinearText(relation, minimal = false) {
  const { direction, dimension } = relation.properties;
  const vocab = LINEAR_VOCABULARIES[dimension] || LINEAR_VOCABULARIES.size;

  if (minimal) {
    if (direction === 1) return vocab.minimal.forward;
    if (direction === -1) return vocab.minimal.backward;
    return vocab.minimal.equal;
  }

  if (direction === 1) return pickRandom(vocab.forward);
  if (direction === -1) return pickRandom(vocab.backward);
  return pickRandom(vocab.equal);
}

/**
 * Get text for spatial relation
 * Style should be consistent within a question (set via relation.properties.vocabStyle or default)
 */
export function getSpatialText(relation, minimal = false) {
  const { vector, vocabStyle } = relation.properties;
  const dimensions = vector.length;

  // Default to cardinal style if not specified
  const style = vocabStyle || "cardinal";
  const vocab =
    SPATIAL_VOCABULARIES[dimensions]?.[style] ||
    SPATIAL_VOCABULARIES[2].cardinal;

  const key = JSON.stringify(vector);
  const options = vocab[key];

  if (!options || options.length === 0) {
    // Fallback for complex vectors
    return describeVector(vector);
  }

  return pickRandom(options);
}

/**
 * Get text for categorical relation
 */
export function getCategoricalText(relation, minimal = false) {
  const { same } = relation.properties;
  const vocab = same
    ? CATEGORICAL_VOCABULARIES.same
    : CATEGORICAL_VOCABULARIES.different;
  return pickRandom(vocab);
}

/**
 * Fallback: describe vector in natural language
 */
function describeVector(vector) {
  const directions = [];

  if (vector[0] > 0) directions.push("east");
  if (vector[0] < 0) directions.push("west");
  if (vector[1] > 0) directions.push("north");
  if (vector[1] < 0) directions.push("south");

  if (vector.length >= 3) {
    if (vector[2] > 0) directions.push("above");
    if (vector[2] < 0) directions.push("below");
  }

  if (vector.length >= 4) {
    if (vector[3] > 0) return `in the future, ${directions.join("-")} of`;
    if (vector[3] < 0) return `in the past, ${directions.join("-")} of`;
  }

  if (directions.length === 0) return "at the same location as";
  return `is ${directions.join("-")} of`;
}

/**
 * Get relation text (main entry point)
 */
export function getRelationText(relation, minimal = false) {
  if (relation.type.name === "Linear") {
    return getLinearText(relation, minimal);
  } else if (relation.type.name === "Spatial") {
    return getSpatialText(relation, minimal);
  } else if (relation.type.name === "Categorical") {
    return getCategoricalText(relation, minimal);
  }

  return "relates to";
}
