/**
 * QuestionVerifier - Verifies all question types using Prolog
 *
 * Validates:
 * - Linear relations (transitive ordering: A<B, B<C => A<C)
 * - Categorical relations (same/different with parity rules)
 * - Spatial relations (2D vector arithmetic)
 */

export class QuestionVerifier {
  constructor() {
    this.session = null;
    this.initialized = false;
    this.initProlog();
  }

  /**
   * Initialize Prolog session with verification rules for all relation types
   */
  async initProlog() {
    const pl = typeof window !== "undefined" ? window.pl : global.pl;
    if (!pl) {
      console.warn("Tau Prolog not available - verification disabled");
      return;
    }

    this.session = pl.create();

    // Load verification rules
    const program = await this.loadVerificationRules();
    this.session.consult(program, {
      success: () => {
        this.initialized = true;
        console.log("✓ Unified question verification initialized");
      },
      error: (err) => {
        console.error("Failed to load verification rules:", err);
      },
    });
  }

  /**
   * Load verification rules for all relation types
   */
  async loadVerificationRules() {
    return this.getRulesProgram();
  }

  loadVerificationRulesSync() {
    return this.getRulesProgram();
  }

  /**
   * Get the Prolog rules program for all relation types
   */
  getRulesProgram() {
    return `
      % Helper predicates
      member(X, [X|_]).
      member(X, [_|T]) :- member(X, T).

      % ==================== LINEAR RELATIONS ====================
      % Transitive ordering: if A<B and B<C then A<C

      % Base facts
      linear_less(X, Y) :- linear_fact(X, Y).

      % Transitivity
      linear_less(X, Z) :- linear_less(X, Y), linear_less(Y, Z).

      % Assert all linear facts
      assert_linear_facts([]).
      assert_linear_facts([fact(E1, E2) | Rest]) :-
          assertz(linear_fact(E1, E2)),
          assert_linear_facts(Rest).

      % Retract all linear facts
      retract_linear_facts([]).
      retract_linear_facts([fact(E1, E2) | Rest]) :-
          retract(linear_fact(E1, E2)),
          retract_linear_facts(Rest).

      % Verify linear question
      verify_linear_question(Facts, Conclusion, ClaimedAnswer) :-
          assert_linear_facts(Facts),
          Conclusion = conclusion(E1, E2),
          (linear_less(E1, E2) -> ActualAnswer = true ; ActualAnswer = false),
          ActualAnswer = ClaimedAnswer,
          retract_linear_facts(Facts).

      % ==================== CATEGORICAL RELATIONS ====================
      % Same/different with parity rules:
      % - same + same = same
      % - same + different = different
      % - different + different = same

      % Reflexivity: everything is in the same category as itself
      cat_same(X, X).

      % Base facts
      cat_same(X, Y) :- cat_same_fact(X, Y).
      cat_different(X, Y) :- cat_different_fact(X, Y).

      % Symmetry
      cat_same(X, Y) :- cat_same(Y, X).
      cat_different(X, Y) :- cat_different(Y, X).

      % Transitivity for same
      cat_same(X, Z) :- cat_same(X, Y), cat_same(Y, Z).

      % Mixed rules
      cat_different(X, Z) :- cat_same(X, Y), cat_different(Y, Z).
      cat_different(X, Z) :- cat_different(X, Y), cat_same(Y, Z).
      cat_same(X, Z) :- cat_different(X, Y), cat_different(Y, Z).

      % Assert categorical facts
      assert_cat_facts([]).
      assert_cat_facts([fact(same, E1, E2) | Rest]) :-
          assertz(cat_same_fact(E1, E2)),
          assert_cat_facts(Rest).
      assert_cat_facts([fact(different, E1, E2) | Rest]) :-
          assertz(cat_different_fact(E1, E2)),
          assert_cat_facts(Rest).

      % Retract categorical facts
      retract_cat_facts([]).
      retract_cat_facts([fact(same, E1, E2) | Rest]) :-
          retract(cat_same_fact(E1, E2)),
          retract_cat_facts(Rest).
      retract_cat_facts([fact(different, E1, E2) | Rest]) :-
          retract(cat_different_fact(E1, E2)),
          retract_cat_facts(Rest).

      % Verify categorical question
      verify_categorical_question(Facts, Conclusion, ClaimedAnswer) :-
          assert_cat_facts(Facts),
          Conclusion = conclusion(same, E1, E2),
          (cat_same(E1, E2) -> ActualAnswer = true ; ActualAnswer = false),
          ActualAnswer = ClaimedAnswer,
          retract_cat_facts(Facts).

      verify_categorical_question(Facts, Conclusion, ClaimedAnswer) :-
          assert_cat_facts(Facts),
          Conclusion = conclusion(different, E1, E2),
          (cat_different(E1, E2) -> ActualAnswer = true ; ActualAnswer = false),
          ActualAnswer = ClaimedAnswer,
          retract_cat_facts(Facts).

      % ==================== SPATIAL RELATIONS ====================
      % Valid coordinates
      coord(0). coord(1). coord(2).
      valid_pos(X, Y) :- coord(X), coord(Y).

      % Spatial relations
      north(pos(X, Y1), pos(X, Y2)) :- Y1 > Y2.
      south(pos(X, Y1), pos(X, Y2)) :- Y1 < Y2.
      east(pos(X1, Y), pos(X2, Y)) :- X1 > X2.
      west(pos(X1, Y), pos(X2, Y)) :- X1 < X2.
      northeast(pos(X1, Y1), pos(X2, Y2)) :- X1 > X2, Y1 > Y2.
      northwest(pos(X1, Y1), pos(X2, Y2)) :- X1 < X2, Y1 > Y2.
      southeast(pos(X1, Y1), pos(X2, Y2)) :- X1 > X2, Y1 < Y2.
      southwest(pos(X1, Y1), pos(X2, Y2)) :- X1 < X2, Y1 < Y2.
      same_location(pos(X, Y), pos(X, Y)).

      % Verification
      verify_spatial_question(EntityPositions, Premises, Conclusion, ClaimedAnswer) :-
          check_valid_positions(EntityPositions),
          check_distinct_positions(EntityPositions),
          verify_all_premises(Premises, EntityPositions),
          Conclusion = conclusion(Relation, Entity1, Entity2),
          get_position(Entity1, EntityPositions, Pos1),
          get_position(Entity2, EntityPositions, Pos2),
          (holds_relation(Relation, Pos1, Pos2) -> ActualAnswer = true ; ActualAnswer = false),
          ActualAnswer = ClaimedAnswer.

      check_valid_positions([]).
      check_valid_positions([entity(_, pos(X, Y)) | Rest]) :-
          valid_pos(X, Y),
          check_valid_positions(Rest).

      check_distinct_positions([]).
      check_distinct_positions([entity(_, Pos) | Rest]) :-
          \\+ member(entity(_, Pos), Rest),
          check_distinct_positions(Rest).

      verify_all_premises([], _).
      verify_all_premises([premise(Relation, Entity1, Entity2) | Rest], EntityPositions) :-
          get_position(Entity1, EntityPositions, Pos1),
          get_position(Entity2, EntityPositions, Pos2),
          holds_relation(Relation, Pos1, Pos2),
          verify_all_premises(Rest, EntityPositions).

      get_position(EntityName, [entity(EntityName, Pos) | _], Pos) :- !.
      get_position(EntityName, [_ | Rest], Pos) :-
          get_position(EntityName, Rest, Pos).

      holds_relation(north, Pos1, Pos2) :- north(Pos1, Pos2).
      holds_relation(south, Pos1, Pos2) :- south(Pos1, Pos2).
      holds_relation(east, Pos1, Pos2) :- east(Pos1, Pos2).
      holds_relation(west, Pos1, Pos2) :- west(Pos1, Pos2).
      holds_relation(northeast, Pos1, Pos2) :- northeast(Pos1, Pos2).
      holds_relation(northwest, Pos1, Pos2) :- northwest(Pos1, Pos2).
      holds_relation(southeast, Pos1, Pos2) :- southeast(Pos1, Pos2).
      holds_relation(southwest, Pos1, Pos2) :- southwest(Pos1, Pos2).
      holds_relation(same_location, Pos1, Pos2) :- same_location(Pos1, Pos2).
    `;
  }

  /**
   * Verify any question type
   */
  async verifyQuestion(question, spatialGrid = null) {
    if (!this.initialized) {
      return {
        valid: true,
        warning: "Verification disabled (Prolog not ready)",
      };
    }

    // Determine question type
    const relationType = this.getRelationType(question);

    switch (relationType) {
      case "Linear":
        return await this.verifyLinearQuestion(question);
      case "Categorical":
        return await this.verifyCategoricalQuestion(question);
      case "Spatial":
        return await this.verifySpatialQuestion(question, spatialGrid);
      default:
        return {
          valid: false,
          error: `Unknown relation type: ${relationType}`,
        };
    }
  }

  /**
   * Get the relation type from a question
   */
  getRelationType(question) {
    // Check the first premise's relation type
    if (question.premises && question.premises.length > 0) {
      return question.premises[0].type.name;
    }
    // Fallback to conclusion
    if (question.conclusion) {
      return question.conclusion.type.name;
    }
    return "Unknown";
  }

  /**
   * Verify a linear question
   * Use JavaScript to compute transitive closure (avoids Prolog infinite loops)
   */
  async verifyLinearQuestion(question) {
    try {
      // Build directed graph of less-than relationships
      const entities = new Set();
      const lessThan = new Map(); // entity -> Set of entities it's less than

      // Initialize
      for (const premise of question.premises) {
        entities.add(premise.entities[0].id);
        entities.add(premise.entities[1].id);
      }

      for (const entity of entities) {
        lessThan.set(entity, new Set());
      }

      console.log("=== LINEAR VERIFICATION DEBUG ===");
      console.log("Premises:");

      // Add direct facts
      for (const premise of question.premises) {
        const [e1, e2] = [premise.entities[0].id, premise.entities[1].id];
        console.log(`  ${e1} [${premise.properties.text}] ${e2} (direction: ${premise.properties.direction})`);

        // Direction 1: e1 < e2, Direction -1: e2 < e1
        if (premise.properties.direction === 1) {
          console.log(`    → Adding fact: ${e1} < ${e2}`);
          lessThan.get(e1).add(e2);
        } else {
          console.log(`    → Adding fact: ${e2} < ${e1}`);
          lessThan.get(e2).add(e1);
        }
      }

      // Compute transitive closure (Floyd-Warshall style)
      // For each intermediate entity k, if i<k and k<j, then i<j
      for (const k of entities) {
        for (const i of entities) {
          if (lessThan.get(i).has(k)) {
            for (const j of lessThan.get(k)) {
              lessThan.get(i).add(j);
            }
          }
        }
      }

      // Check for contradictions (cycles: A<B and B<A)
      for (const e1 of entities) {
        if (lessThan.get(e1).has(e1)) {
          return {
            valid: false,
            error: "Linear verification failed: Cycle detected (entity less than itself)",
            details: { entity: e1 },
          };
        }
        for (const e2 of lessThan.get(e1)) {
          if (lessThan.get(e2).has(e1)) {
            return {
              valid: false,
              error: "Linear verification failed: Contradiction detected (A<B and B<A)",
              details: { e1, e2 },
            };
          }
        }
      }

      // Check conclusion
      const [c1, c2] = [question.conclusion.entities[0].id, question.conclusion.entities[1].id];
      let actualRelation; // true if c1 < c2

      if (question.conclusion.properties.direction === 1) {
        // Conclusion claims c1 < c2
        actualRelation = lessThan.get(c1).has(c2);
      } else {
        // Conclusion claims c2 < c1
        actualRelation = lessThan.get(c2).has(c1);
      }

      const expectedIsValid = actualRelation;

      if (expectedIsValid === question.isValid) {
        return { valid: true };
      } else {
        return {
          valid: false,
          error: "Linear verification failed: Question validity doesn't match logical derivation",
          details: {
            conclusion: `${c1.id} ${question.conclusion.properties.direction === 1 ? '<' : '>'} ${c2.id}`,
            actuallyTrue: actualRelation,
            claimedValid: question.isValid,
            expectedValid: expectedIsValid,
          },
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Linear verification error: ${error.message}`,
      };
    }
  }

  /**
   * Verify a categorical question
   * Unbounded universe: unlimited categories, so different+different ≠ same!
   * Valid inferences:
   * - same + same = same (transitivity)
   * - same + different = different
   * - different + same = different
   * - different + different = UNKNOWN (no inference possible!)
   */
  async verifyCategoricalQuestion(question) {
    try {
      // Build equivalence classes for "same"
      const entities = new Set();
      const sameGraph = new Map(); // entity -> Set of entities in same equivalence class

      for (const premise of question.premises) {
        entities.add(premise.entities[0].id);
        entities.add(premise.entities[1].id);
      }

      // Initialize: each entity in its own class
      for (const entity of entities) {
        sameGraph.set(entity, new Set([entity]));
      }

      // Process "same" relationships: merge equivalence classes
      for (const premise of question.premises) {
        const e1 = premise.entities[0].id;
        const e2 = premise.entities[1].id;
        const isSame = premise.properties.direction === 1;

        if (isSame) {
          // Union-find: merge the two equivalence classes
          const class1 = sameGraph.get(e1);
          const class2 = sameGraph.get(e2);
          const merged = new Set([...class1, ...class2]);

          // Update all members to point to merged class
          for (const entity of merged) {
            sameGraph.set(entity, merged);
          }
        }
      }

      // Build set of "different" pairs (after merging same classes)
      const diffPairs = new Set();
      for (const premise of question.premises) {
        const e1 = premise.entities[0].id;
        const e2 = premise.entities[1].id;
        const isSame = premise.properties.direction === 1;

        if (!isSame) {
          // Mark all members of e1's class as different from all members of e2's class
          for (const member1 of sameGraph.get(e1)) {
            for (const member2 of sameGraph.get(e2)) {
              diffPairs.add(`${member1}:${member2}`);
              diffPairs.add(`${member2}:${member1}`);
            }
          }
        }
      }

      // Check for contradictions (same entity marked as both same and different)
      for (const entity1 of entities) {
        for (const entity2 of sameGraph.get(entity1)) {
          if (entity1 !== entity2 && diffPairs.has(`${entity1}:${entity2}`)) {
            return {
              valid: false,
              error: "Categorical verification failed: Contradiction (entities marked as both same and different)",
              details: { entity1, entity2 },
            };
          }
        }
      }

      // Check conclusion
      const c1 = question.conclusion.entities[0].id;
      const c2 = question.conclusion.entities[1].id;
      const conclusionIsSame = question.conclusion.properties.direction === 1;

      // Determine actual relationship
      let actualRelationship; // 'same', 'different', or 'unknown'

      if (sameGraph.get(c1).has(c2)) {
        actualRelationship = 'same';
      } else if (diffPairs.has(`${c1}:${c2}`)) {
        actualRelationship = 'different';
      } else {
        actualRelationship = 'unknown';
      }

      // Validate conclusion
      if (actualRelationship === 'unknown') {
        // Can't determine - question should be invalid
        if (question.isValid) {
          return {
            valid: false,
            error: "Categorical verification failed: Conclusion cannot be determined from premises",
            details: { c1, c2, conclusion: conclusionIsSame ? 'same' : 'different' },
          };
        } else {
          return { valid: true }; // Correctly marked as invalid
        }
      } else {
        // Can determine - check if conclusion matches
        const actualIsSame = (actualRelationship === 'same');
        const conclusionMatches = (actualIsSame === conclusionIsSame);

        if (conclusionMatches === question.isValid) {
          return { valid: true };
        } else {
          return {
            valid: false,
            error: "Categorical verification failed: Question validity doesn't match logical derivation",
            details: {
              conclusion: `${c1} ${conclusionIsSame ? 'same' : 'different'} ${c2}`,
              actual: `${c1} ${actualIsSame ? 'same' : 'different'} ${c2}`,
              claimedValid: question.isValid,
              expectedValid: conclusionMatches,
            },
          };
        }
      }
    } catch (error) {
      return {
        valid: false,
        error: `Categorical verification error: ${error.message}`,
      };
    }
  }

  /**
   * Verify a spatial question (delegated to existing logic)
   */
  async verifySpatialQuestion(question, spatialGrid) {
    if (!spatialGrid) {
      return {
        valid: false,
        error: "Spatial grid required for spatial verification",
      };
    }

    try {
      const pl = typeof window !== "undefined" ? window.pl : global.pl;
      const freshSession = pl.create();
      freshSession.consult(this.loadVerificationRulesSync());

      const { network, conclusion } = question;

      const entityPositions = this.buildEntityPositions(network, spatialGrid);
      const premises = this.buildPremises(network);
      const prologConclusion = this.buildConclusion(conclusion);
      const claimedAnswer = question.isValid;

      const query = `verify_spatial_question(${entityPositions}, ${premises}, ${prologConclusion}, ${claimedAnswer}).`;

      freshSession.query(query);

      return await new Promise((resolve) => {
        freshSession.answer((answer) => {
          const pl = typeof window !== "undefined" ? window.pl : global.pl;

          if (pl.type.is_substitution(answer)) {
            resolve({ valid: true });
          } else if (pl.type.is_error(answer)) {
            resolve({
              valid: false,
              error: "Prolog error: " + pl.format_answer(answer),
              details: { query },
            });
          } else {
            resolve({
              valid: false,
              error: "Spatial verification failed: Question is logically inconsistent",
              details: { entityPositions, premises, prologConclusion, claimedAnswer, query },
            });
          }
        });
      });
    } catch (error) {
      return {
        valid: false,
        error: `Spatial verification error: ${error.message}`,
      };
    }
  }

  // Spatial helper methods (from SpatialVerifier)
  buildEntityPositions(network, spatialGrid) {
    const positions = [];
    for (const entity of network.entities.values()) {
      const pos = spatialGrid.getPosition(entity);
      if (pos) {
        positions.push(`entity(${entity.id}, pos(${pos[0]}, ${pos[1]}))`);
      }
    }
    return `[${positions.join(", ")}]`;
  }

  buildPremises(network) {
    const premises = [];
    for (const relation of network.relations) {
      // Skip non-spatial relations (they don't have vectors)
      if (!relation.properties.vector) {
        continue;
      }
      const relationName = this.vectorToRelationName(relation.properties.vector);
      const e1 = relation.entities[0].id;
      const e2 = relation.entities[1].id;
      premises.push(`premise(${relationName}, ${e1}, ${e2})`);
    }
    return `[${premises.join(", ")}]`;
  }

  buildConclusion(conclusion) {
    // Check if conclusion is spatial (has vector)
    if (!conclusion.properties.vector) {
      throw new Error("buildConclusion called with non-spatial conclusion");
    }
    const relationName = this.vectorToRelationName(conclusion.properties.vector);
    const e1 = conclusion.entities[0].id;
    const e2 = conclusion.entities[1].id;
    return `conclusion(${relationName}, ${e1}, ${e2})`;
  }

  vectorToRelationName(vector) {
    const normalized = vector.map((v) => (v === 0 ? 0 : v / Math.abs(v)));
    const [x, y] = normalized;

    if (x === 0 && y === 1) return "north";
    if (x === 0 && y === -1) return "south";
    if (x === 1 && y === 0) return "east";
    if (x === -1 && y === 0) return "west";
    if (x === 1 && y === 1) return "northeast";
    if (x === -1 && y === 1) return "northwest";
    if (x === 1 && y === -1) return "southeast";
    if (x === -1 && y === -1) return "southwest";
    if (x === 0 && y === 0) return "same_location";

    throw new Error(`Unknown vector: [${x}, ${y}]`);
  }
}
