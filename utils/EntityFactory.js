import { Entity } from "../core/Entity.js";

/**
 * EntityFactory creates unique entities with various display values.
 * This is a simplified version - can be extended with more generators.
 */
export class EntityFactory {
  /**
   * @param {Object} config
   * @param {boolean} config.useNonsenseWords
   * @param {number} config.nonsenseWordLength
   * @param {RandomUtils} random
   */
  constructor(config = {}, random = null) {
    this.config = {
      useNonsenseWords: config.useNonsenseWords !== false,
      nonsenseWordLength: config.nonsenseWordLength || 5,
      ...config,
    };
    this.random = random || { random: () => Math.random() };
    this.usedValues = new Set();
    this.counter = 0;
  }

  /**
   * Create N entities
   * @param {number} count
   * @returns {Entity[]}
   */
  createEntities(count) {
    const entities = [];
    for (let i = 0; i < count; i++) {
      entities.push(this.createEntity());
    }
    return entities;
  }

  /**
   * Create a single entity
   * @returns {Entity}
   */
  createEntity() {
    const displayValue = this.generateUniqueValue();
    const id = `entity_${Date.now()}_${this.counter++}_${Math.random().toString(36).substr(2, 9)}`;
    return new Entity(id, displayValue);
  }

  /**
   * Generate a unique display value
   * @returns {string}
   */
  generateUniqueValue() {
    let value;
    let attempts = 0;

    do {
      value = this.generateValue();
      attempts++;
      if (attempts > 1000) {
        throw new Error(
          "Could not generate unique entity value after 1000 attempts",
        );
      }
    } while (this.usedValues.has(value));

    this.usedValues.add(value);
    return value;
  }

  /**
   * Generate a single value (may not be unique)
   * @returns {string}
   */
  generateValue() {
    // For now, just use nonsense words
    // This can be extended to support emoji, meaningful words, etc.
    return this.createNonsenseWord();
  }

  /**
   * Create a nonsense word (consonant-vowel pattern)
   * @returns {string}
   */
  createNonsenseWord() {
    const vowels = ["A", "E", "I", "O", "U"];
    const consonants = [
      "B",
      "C",
      "D",
      "F",
      "G",
      "H",
      "J",
      "K",
      "L",
      "M",
      "N",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "V",
      "W",
      "X",
      "Y",
      "Z",
    ];
    // Banned words to avoid offensive combinations
    const bannedWords = [
      "DIC",
      "DIK",
      "COC",
      "COK",
      "FUC",
      "FUK",
      "FEC",
      "FEK",
      "NIG",
      "PIS",
      "TIT",
      "SEX",
      "GAY",
      "FAG",
      "CUM",
      "ASS",
      "FUCK",
      "SHIT",
      "DAMN",
      "HELL",
      "CRAP",
      "PISS",
    ];

    let word = "";
    const length = this.config.nonsenseWordLength;

    for (let i = 0; i < 100; i++) {
      // Max 100 attempts
      word = "";
      for (let j = 0; j < length; j++) {
        if (j % 2 === 0) {
          // Consonant
          word +=
            consonants[Math.floor(this.random.random() * consonants.length)];
        } else {
          // Vowel
          word += vowels[Math.floor(this.random.random() * vowels.length)];
        }
      }

      // Check if word contains banned substring
      if (!bannedWords.some((banned) => word.includes(banned))) {
        return word;
      }
    }

    // Fallback if we can't generate a clean word
    return word;
  }

  /**
   * Reset the factory (clear used values)
   */
  reset() {
    this.usedValues.clear();
    this.counter = 0;
  }
}
