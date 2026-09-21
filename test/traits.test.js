import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULTS,
  EMOTIONS,
  EYE_PALETTE,
  EYE_STYLES,
  FACE_PALETTE,
  Monako,
  SHAPES,
  TOKEN_NAME,
  TOKEN_VERSION,
  TRAIT_SPECS,
  emotions,
} from '../dist/monako.esm.js';

/**
 * The unions in `types.js` are hand-written, because `Object.freeze` widens a
 * string-literal array to `readonly string[]` and the literal union is the
 * half worth having. That leaves two places to edit, so these tests fail loudly
 * when only one of them gets edited.
 *
 * Keep these lists in step with `src/types.js` by hand — that is the point.
 */
const DOCUMENTED = {
  EmotionName: ['neutral', 'sad', 'surprised', 'love'],
  ShapeName: ['circle', 'square', 'rounded', 'blob', 'drop', 'pill'],
  EyeStyleName: ['smooth', 'pixel', 'pill', 'none'],
};

test('registry matches the unions documented in types.js', () => {
  assert.deepEqual([...EMOTIONS], DOCUMENTED.EmotionName);
  assert.deepEqual([...SHAPES], DOCUMENTED.ShapeName);
  assert.deepEqual([...EYE_STYLES], DOCUMENTED.EyeStyleName);
});

test('every registered emotion has a definition, and vice versa', () => {
  assert.deepEqual(Object.keys(emotions), [...EMOTIONS]);
});

test('emotion definitions carry the fields the renderer reads', () => {
  for (const name of EMOTIONS) {
    const def = emotions[name];
    for (const side of ['leftEye', 'rightEye']) {
      for (const field of ['rx', 'ry', 'cx', 'cy']) {
        assert.equal(typeof def[side][field], 'number', `${name}.${side}.${field}`);
      }
    }
    assert.equal(typeof def.lookRange, 'number', `${name}.lookRange`);
    assert.equal(def.blinkInterval.length, 2, `${name}.blinkInterval`);
    assert.ok(def.blinkInterval[0] < def.blinkInterval[1], `${name}.blinkInterval is ordered`);
  }
});

test('registries are frozen', () => {
  for (const list of [EMOTIONS, SHAPES, EYE_STYLES, FACE_PALETTE, EYE_PALETTE, TRAIT_SPECS]) {
    assert.ok(Object.isFrozen(list));
  }
  assert.ok(Object.isFrozen(DEFAULTS));
});

test('registries contain no duplicates', () => {
  // A duplicate silently doubles that entry's odds and makes the modulo lie.
  for (const [name, list] of Object.entries({ EMOTIONS, SHAPES, EYE_STYLES, FACE_PALETTE, EYE_PALETTE })) {
    assert.equal(new Set(list).size, list.length, `${name} has a duplicate`);
  }
});

test('palettes are lowercase #rrggbb', () => {
  for (const color of [...FACE_PALETTE, ...EYE_PALETTE]) {
    assert.match(color, /^#[0-9a-f]{6}$/, `${color} is not normalised`);
  }
});

test('face palette starts with the designed vibrant colours', () => {
  // Vibrant, friendly palette. If the app palette moves, this is the reminder
  // to append rather than reorder.
  assert.deepEqual(FACE_PALETTE.slice(0, 6), [
    '#9b56ff',  // Purple
    '#0086ff',  // Blue
    '#9f6535',  // Brown
    '#ff009e',  // Pink/Magenta
    '#ff9000',  // Orange
    '#ff5900',  // Orange-Red
  ]);
});

test('every default is a member of its registry', () => {
  assert.ok(EMOTIONS.includes(DEFAULTS.emotion));
  assert.ok(SHAPES.includes(DEFAULTS.shape));
  assert.ok(EYE_STYLES.includes(DEFAULTS.eyeStyle));
});

test('trait specs cover every trait exactly once', () => {
  const fields = TRAIT_SPECS.map((spec) => spec.field);
  assert.deepEqual([...fields].sort(), Object.keys(DEFAULTS).sort());
  assert.equal(new Set(TRAIT_SPECS.map((s) => s.key)).size, TRAIT_SPECS.length);
  assert.equal(new Set(TRAIT_SPECS.map((s) => s.salt)).size, TRAIT_SPECS.length, 'salts must be distinct');
});

test('token keys and version are stable', () => {
  // These strings are in other people's databases. Changing one is a new
  // token version, never an edit.
  assert.equal(TOKEN_NAME, 'monako');
  assert.equal(TOKEN_VERSION, 1);
  assert.deepEqual(TRAIT_SPECS.map((s) => s.key), ['shape', 'eyes', 'mood', 'face', 'iris']);
});

test('Monako statics expose the registries', () => {
  assert.deepEqual(Monako.getEmotions(), [...EMOTIONS]);
  assert.deepEqual(Monako.getShapes(), [...SHAPES]);
  assert.deepEqual(Monako.getEyeStyles(), [...EYE_STYLES]);
});

test('Monako statics expose the identity helpers without touching the DOM', () => {
  // Constructing a Monako needs a document; deriving one must not.
  assert.equal(typeof Monako.fromSeed('x').color, 'string');
  assert.equal(Monako.toToken({ emotion: 'love' }), 'monako:1;mood:love');
  assert.equal(Monako.fromToken('monako:1;mood:love').emotion, 'love');
  assert.equal(Monako.isValidToken('monako:1;mood:love'), true);
});
