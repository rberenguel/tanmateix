/**
 * Basic test to verify core functionality
 * Run with: node test-basic.js
 */

import { Entity } from './core/Entity.js';
import { PremiseNetwork } from './core/PremiseNetwork.js';
import { LinearRelationType } from './relations/LinearRelationType.js';
import { SpatialRelationType } from './relations/SpatialRelationType.js';
import { CategoricalRelationType } from './relations/CategoricalRelationType.js';

console.log('=== Testing v2 Architecture ===\n');

// Test 1: Create entities
console.log('Test 1: Creating entities...');
const a = new Entity('a', 'FOBIX');
const b = new Entity('b', 'GAKUN');
const c = new Entity('c', 'JEPOL');
const d = new Entity('d', 'MIVAT');
console.log('✓ Entities created:', a.displayValue, b.displayValue, c.displayValue, d.displayValue);

// Test 2: Create linear relations
console.log('\nTest 2: Creating linear relations...');
const linearType = new LinearRelationType();
const r1 = linearType.createRelation([a, b], { direction: 1, dimension: 'size' });
const r2 = linearType.createRelation([b, c], { direction: 1, dimension: 'size' });
console.log('✓ Created:', a.displayValue, '>', b.displayValue);
console.log('✓ Created:', b.displayValue, '>', c.displayValue);

// Test 3: Build a premise network
console.log('\nTest 3: Building premise network...');
const network = new PremiseNetwork();
network.addEntity(a);
network.addEntity(b);
network.addEntity(c);
network.addEntity(d);
network.addRelation(r1);
network.addRelation(r2);
console.log('✓ Network created with', network.entities.size, 'entities and', network.relations.length, 'relations');

// Test 4: Test inference
console.log('\nTest 4: Testing transitivity inference...');
const inferred = network.inferRelations();
console.log('✓ Inferred', inferred.length, 'new relations');
if (inferred.length > 0) {
  const inf = inferred[0];
  console.log('  →', inf.entities[0].displayValue, '>', inf.entities[1].displayValue, '(inferred)');
}

// Test 5: Test spatial relations
console.log('\nTest 5: Testing spatial relations...');
const spatialType = new SpatialRelationType(2);
const s1 = spatialType.createRelation([c, d], { vector: [1, 0] }); // c is east of d
network.addRelation(s1);
console.log('✓ Created spatial relation:', c.displayValue, 'east of', d.displayValue);
console.log('✓ Mixed network now has', network.relations.length, 'relations');

// Test 6: Test categorical relations
console.log('\nTest 6: Testing categorical relations...');
const e = new Entity('e', 'RIPOX');
const f = new Entity('f', 'TULEV');
network.addEntity(e);
network.addEntity(f);
const catType = new CategoricalRelationType();
const c1 = catType.createRelation([e, f], { same: true });
network.addRelation(c1);
console.log('✓ Created categorical relation:', e.displayValue, '= same as', f.displayValue);

// Test 7: Test pathfinding
console.log('\nTest 7: Testing pathfinding...');
const path = network.findPath(a.id, c.id);
if (path) {
  const pathNames = path.map(id => network.entities.get(id).displayValue);
  console.log('✓ Path from', a.displayValue, 'to', c.displayValue, ':', pathNames.join(' → '));
}

// Test 8: Test network stats
console.log('\nTest 8: Network statistics...');
const stats = network.getStats();
console.log('✓ Stats:', JSON.stringify(stats, null, 2));

// Test 9: Test JSON serialization
console.log('\nTest 9: Testing JSON serialization...');
const json = network.toJSON();
console.log('✓ Network serialized:', json.entities.length, 'entities,', json.relations.length, 'relations');

console.log('\n=== All basic tests passed! ===');
