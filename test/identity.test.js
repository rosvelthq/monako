import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULTS,
  EMOTIONS,
  EYE_PALETTE,
  EYE_STYLES,
  FACE_PALETTE,
  SHAPES,
  fnv1a,
  isValidToken,
  resolveTraits,
  toToken,
  traitsFromSeed,
  traitsFromToken,
} from '../dist/monako.esm.js';

/* ------------------------------------------------------------------ *
 * Golden values
 *
 * These pin the seed → face mapping. They are not testing that the
 * output is *correct* — any mapping would be — but that it never
 * CHANGES. Every one of these is a face somebody may already have
 * saved. If a change to the hash, the salts, or a registry array makes
 * this block fail, that is the test doing its job: the fix is a new
 * token version, not new golden values.
 * ------------------------------------------------------------------ */
const GOLDEN = {
  'naoki-bot': {
    shape: 'rounded',
    eyeStyle: 'pixel',
    emotion: 'curious',
    color: '#2980b9',
    eyeColor: '#ffe9a8',
  },
  '': {
    shape: 'rounded',
    eyeStyle: 'pixel',
    emotion: 'angry',
    color: '#c0392b',
    eyeColor: '#ffffff',
  },
  '0': {
    shape: 'rounded',
    eyeStyle: 'pixel',
    emotion: 'angry',
    color: '#533483',
    eyeColor: '#ffffff',
  },
  a: {
    shape: 'square',
    eyeStyle: 'smooth',
    emotion: 'love',
    color: '#27ae60',
    eyeColor: '#c8f7ff',
  },
  'matth@rosvelt.com': {
    shape: 'square',
    eyeStyle: 'pixel',
    emotion: 'neutral',
    color: '#2c3e50',
    eyeColor: '#ffffff',
  },
  '01a04057-6fa0-7c71-9fb7-717d971cbb75': {
    shape: 'square',
    eyeStyle: 'pixel',
    emotion: 'angry',
    color: '#c0392b',
    eyeColor: '#ffffff',
  },
  'ñandú 🦤': {
    shape: 'rounded',
    eyeStyle: 'smooth',
    emotion: 'love',
    color: '#d35400',
    eyeColor: '#c8f7ff',
  },
};

test('seed derivation is pinned to known values', () => {
  for (const [seed, expected] of Object.entries(GOLDEN)) {
    assert.deepEqual(
      traitsFromSeed(seed),
      expected,
      `seed ${JSON.stringify(seed)} derived a different face than it used to`,
    );
  }
});

test('fnv1a hashes UTF-8 bytes, not code units', () => {
  // 'ñ' is one code unit but two UTF-8 bytes. A code-unit hash would agree
  // with a byte hash on ASCII and diverge here, so this is the canary for a
  // backend reimplementation drifting from the JS one.
  assert.equal(fnv1a('a'), 0xe40c292c);
  assert.equal(fnv1a('ñ'), fnv1a('ñ'));
  assert.notEqual(fnv1a('ñ'), fnv1a('n'));
});

test('derivation is deterministic and total', () => {
  for (const seed of ['x', 'agent-42', '', '🙂', 'a'.repeat(500)]) {
    const first = traitsFromSeed(seed);
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(traitsFromSeed(seed), first);
    }
    assert.ok(SHAPES.includes(first.shape));
    assert.ok(EYE_STYLES.includes(first.eyeStyle));
    assert.ok(EMOTIONS.includes(first.emotion));
    assert.ok(FACE_PALETTE.includes(first.color));
    assert.ok(EYE_PALETTE.includes(first.eyeColor));
  }
});

test('derivation reaches every entry of every registry', () => {
  const seen = { shape: new Set(), eyeStyle: new Set(), emotion: new Set(), color: new Set(), eyeColor: new Set() };

  for (let i = 0; i < 2000; i++) {
    const traits = traitsFromSeed(`seed-${i}`);
    for (const key of Object.keys(seen)) seen[key].add(traits[key]);
  }

  assert.equal(seen.shape.size, SHAPES.length);
  assert.equal(seen.eyeStyle.size, EYE_STYLES.length);
  assert.equal(seen.emotion.size, EMOTIONS.length);
  assert.equal(seen.color.size, FACE_PALETTE.length);
  assert.equal(seen.eyeColor.size, EYE_PALETTE.length);
});

test('traits do not move in lockstep across seeds', () => {
  // Shape and eyeStyle are drawn from lists of different length, but emotion
  // (8) and colour (12) share a hash stream if the salts are dropped. Check
  // that fixing one trait still leaves the others varying.
  const withSquare = [];
  for (let i = 0; i < 2000 && withSquare.length < 50; i++) {
    const traits = traitsFromSeed(`lockstep-${i}`);
    if (traits.shape === 'square') withSquare.push(traits.eyeStyle);
  }
  assert.ok(withSquare.length > 10, 'not enough samples');
  assert.equal(new Set(withSquare).size, EYE_STYLES.length);
});

test('overrides win over the seed', () => {
  const traits = traitsFromSeed('naoki-bot', { emotion: 'love' });
  assert.equal(traits.emotion, 'love');
  assert.equal(traits.color, GOLDEN['naoki-bot'].color, 'untouched traits stay derived');
});

/* ------------------------------------------------------------------ *
 * Token round-trips
 * ------------------------------------------------------------------ */

test('explicit traits round-trip', () => {
  const traits = {
    color: '#533483',
    eyeColor: '#ffe9a8',
    emotion: 'happy',
    shape: 'square',
    eyeStyle: 'pixel',
  };
  const token = toToken(traits);
  assert.deepEqual(traitsFromToken(token), traits);
});

test('seeded faces round-trip, carrying the seed', () => {
  const token = toToken({ seed: 'naoki-bot' });
  assert.equal(token, 'monako:1;seed:naoki-bot');

  const decoded = traitsFromToken(token);
  assert.equal(decoded.seed, 'naoki-bot');
  assert.deepEqual(
    { ...decoded, seed: undefined },
    { ...traitsFromSeed('naoki-bot'), seed: undefined },
  );
});

test('a seeded face with one override writes only the override', () => {
  const token = toToken({ ...traitsFromSeed('naoki-bot'), seed: 'naoki-bot', emotion: 'love' });
  assert.equal(token, 'monako:1;seed:naoki-bot;mood:love');

  const decoded = traitsFromToken(token);
  assert.equal(decoded.emotion, 'love');
  assert.equal(decoded.color, GOLDEN['naoki-bot'].color);
});

test('defaults are omitted', () => {
  assert.equal(toToken(DEFAULTS), 'monako:1');
  assert.deepEqual(traitsFromToken('monako:1'), { ...DEFAULTS });
  assert.equal(toToken({ emotion: 'happy' }), 'monako:1;mood:happy');
});

test('seeds containing token punctuation survive the round-trip', () => {
  for (const seed of ['a,b', 'k=v', 'has space', '100%', 'ñandú 🦤', 'monako:1;nested']) {
    const token = toToken({ seed });
    const decoded = traitsFromToken(token);
    assert.equal(decoded.seed, seed, `seed ${JSON.stringify(seed)} did not survive`);
    assert.deepEqual(
      { ...decoded, seed: undefined },
      { ...traitsFromSeed(seed), seed: undefined },
    );
  }
});

test('colours normalise to lowercase #rrggbb', () => {
  assert.equal(traitsFromToken('monako:1;face:ABCDEF').color, '#abcdef');
  assert.equal(toToken({ color: '#ABCDEF' }), 'monako:1;face:abcdef');
  assert.equal(resolveTraits({ color: '#ABC' }).color, '#aabbcc');
});

/* ------------------------------------------------------------------ *
 * Forgiving where it should be, strict where it should be
 * ------------------------------------------------------------------ */

test('unknown keys are ignored', () => {
  // A newer writer adding a trait must not break an older reader.
  const decoded = traitsFromToken('monako:1;mood:happy;eyebrows:bushy;hat:fedora');
  assert.equal(decoded.emotion, 'happy');
  assert.deepEqual(decoded, { ...DEFAULTS, emotion: 'happy' });
});

test('unknown enum values fall back rather than throw', () => {
  assert.equal(traitsFromToken('monako:1;mood:wink').emotion, DEFAULTS.emotion);
  assert.equal(traitsFromToken('monako:1;shape:blob').shape, DEFAULTS.shape);
  assert.equal(
    traitsFromToken('monako:1;seed:naoki-bot;mood:wink').emotion,
    GOLDEN['naoki-bot'].emotion,
    'falls back to the seeded value, not the global default',
  );
});

test('unparseable colours fall back', () => {
  assert.equal(traitsFromToken('monako:1;face:notacolor').color, DEFAULTS.color);
  assert.equal(traitsFromToken('monako:1;face:12345').color, DEFAULTS.color);
});

test('structural garbage throws', () => {
  assert.throws(() => traitsFromToken('nope'), TypeError);
  assert.throws(() => traitsFromToken('monako:2;mood:happy'), TypeError);
  assert.throws(() => traitsFromToken('monako:1;moodhappy'), TypeError);
  assert.throws(() => traitsFromToken(null), TypeError);
  assert.throws(() => traitsFromToken(42), TypeError);
});

test('isValidToken guards storage reads', () => {
  assert.equal(isValidToken('monako:1;mood:happy'), true);
  assert.equal(isValidToken('monako:1'), true);
  assert.equal(isValidToken('monako:1;mood:wink'), true, 'forgiving values are still valid');
  assert.equal(isValidToken('sql injection'), false);
  assert.equal(isValidToken(null), false);
  assert.equal(isValidToken(undefined), false);
  assert.equal(isValidToken(''), false);
});

/* ------------------------------------------------------------------ *
 * Precedence
 * ------------------------------------------------------------------ */

test('resolveTraits precedence: defaults < seed < token < explicit', () => {
  assert.deepEqual(resolveTraits({}), { ...DEFAULTS });

  assert.equal(resolveTraits({ seed: 'naoki-bot' }).emotion, GOLDEN['naoki-bot'].emotion);

  assert.equal(
    resolveTraits({ seed: 'naoki-bot', token: 'monako:1;mood:sad' }).emotion,
    'sad',
    'token beats seed',
  );

  assert.equal(
    resolveTraits({ seed: 'naoki-bot', token: 'monako:1;mood:sad', emotion: 'happy' }).emotion,
    'happy',
    'explicit beats token',
  );

  assert.equal(
    resolveTraits({ token: 'monako:1;seed:a', seed: 'b' }).color,
    traitsFromSeed('a').color,
    "a token's own seed beats the seed option",
  );
});

test('explicit non-hex colours pass through untouched', () => {
  // 'rebeccapurple' and 'var(--brand)' are valid SVG fills; the library has no
  // business rejecting them just because it cannot put them in a token.
  assert.equal(resolveTraits({ color: 'rebeccapurple' }).color, 'rebeccapurple');
  assert.equal(resolveTraits({ color: 'var(--brand)' }).color, 'var(--brand)');
});

test('seed 0 is a seed, not an absence of one', () => {
  // `seed: options.seed || null` used to turn 0 into null and fall back to
  // Math.random, quietly making the face non-reproducible.
  assert.deepEqual(resolveTraits({ seed: 0 }), { ...traitsFromSeed('0'), seed: '0' });
  assert.equal(resolveTraits({ seed: 0 }).seed, '0');
});

test('numeric and string seeds agree', () => {
  assert.deepEqual(
    { ...traitsFromSeed(42), seed: undefined },
    { ...traitsFromSeed('42'), seed: undefined },
  );
});

/* ------------------------------------------------------------------ *
 * Regressions
 *
 * Each of these is a bug a review caught that the suite above did not.
 * The pattern in every case: a test asserted one field and missed that
 * the others had been trampled.
 * ------------------------------------------------------------------ */

test('a partial token layers over a seed without wiping it', () => {
  // `traitsFromToken` fills its gaps from DEFAULTS, so spreading its whole
  // result over the seeded traits reset every trait the token did not name.
  // `<MonakoFace seed={agent.id} token={agent.avatarFace} />` — the pattern the
  // README recommends — turned every customised agent into a black circle.
  const seeded = traitsFromSeed('naoki-bot');
  const resolved = resolveTraits({ seed: 'naoki-bot', token: 'monako:1;mood:happy' });

  assert.equal(resolved.emotion, 'happy', 'the token trait applies');
  assert.equal(resolved.shape, seeded.shape, 'shape stays seeded');
  assert.equal(resolved.eyeStyle, seeded.eyeStyle, 'eyeStyle stays seeded');
  assert.equal(resolved.color, seeded.color, 'colour stays seeded');
  assert.equal(resolved.eyeColor, seeded.eyeColor, 'eyeColor stays seeded');
  assert.equal(resolved.seed, 'naoki-bot');

  // The whole face, not one field — that is what the old test missed.
  assert.deepEqual(resolved, { ...seeded, emotion: 'happy', seed: 'naoki-bot' });
});

test('an empty token over a seed changes nothing', () => {
  assert.deepEqual(
    resolveTraits({ seed: 'naoki-bot', token: 'monako:1' }),
    { ...traitsFromSeed('naoki-bot'), seed: 'naoki-bot' },
  );
});

test('a token with its own seed re-bases the whole face', () => {
  // This one *should* replace everything: the token is a complete statement.
  assert.deepEqual(
    resolveTraits({ seed: 'ignored', token: 'monako:1;seed:naoki-bot' }),
    { ...traitsFromSeed('naoki-bot'), seed: 'naoki-bot' },
  );
});

test('toToken refuses to silently drop what it cannot represent', () => {
  // It used to skip these, returning a token that renders a different face
  // than the one being serialised.
  assert.throws(
    () => toToken({ color: 'rebeccapurple', emotion: 'happy' }),
    /cannot serialise color/,
  );
  assert.throws(
    () => toToken({ color: 'var(--brand)' }),
    /hex colours only/,
  );
  assert.throws(
    () => toToken({ emotion: 'banana' }),
    /cannot serialise emotion/,
  );
  assert.throws(
    () => toToken({ shape: 'blob' }),
    /expected one of circle, square, rounded/,
  );
});

test('toToken still ignores traits that are simply absent', () => {
  // Absent is not the same as unrepresentable.
  assert.equal(toToken({ emotion: 'happy' }), 'monako:1;mood:happy');
  assert.equal(toToken({ emotion: 'happy', color: undefined }), 'monako:1;mood:happy');
  assert.equal(toToken({ emotion: 'happy', color: null }), 'monako:1;mood:happy');
});

/* ------------------------------------------------------------------ *
 * Wire format
 * ------------------------------------------------------------------ */

test('a token is CSS declaration syntax', () => {
  assert.equal(toToken({}), 'monako:1');
  assert.equal(toToken({ seed: 'x' }), 'monako:1;seed:x');
  assert.equal(
    toToken({ emotion: 'happy', shape: 'square', color: '#533483' }),
    'monako:1;shape:square;mood:happy;face:533483',
  );

  // Every declaration is `key:value`, `;` separates them, and the version
  // leads — the same shape as `color: red; font-size: 12px`.
  for (const token of ['monako:1', 'monako:1;seed:x', 'monako:1;shape:square;mood:happy']) {
    const declarations = token.split(';');
    assert.equal(declarations[0], 'monako:1', 'the version leads');
    for (const declaration of declarations) {
      assert.match(declaration, /^[a-z]+:[^;]*$/, `"${declaration}" is not key:value`);
    }
    assert.ok(!token.includes(','), `${token} still contains a comma`);
    assert.ok(!token.includes('='), `${token} still contains an equals sign`);
  }
});

test('the version declaration is optional when reading, mandatory when writing', () => {
  // Hand-writing `mood:happy` is meant to be pleasant. Anything that reaches a
  // database is pinned, so a later registry cannot silently repaint it.
  assert.equal(traitsFromToken('mood:happy').emotion, 'happy');
  assert.equal(traitsFromToken('monako:1;mood:happy').emotion, 'happy');
  assert.deepEqual(traitsFromToken('mood:happy'), traitsFromToken('monako:1;mood:happy'));

  for (const traits of [{}, { seed: 'x' }, { emotion: 'happy' }]) {
    assert.ok(toToken(traits).startsWith('monako:1'), 'every written token pins its version');
  }
});

test('a future version is refused rather than guessed at', () => {
  assert.throws(() => traitsFromToken('monako:2;mood:happy'), /only decodes version 1/);
  assert.equal(isValidToken('monako:2;mood:happy'), false);
});

test('a string that merely contains a colon is not a token', () => {
  // With the version optional, "key:value" alone is too loose a shape.
  for (const notAToken of ['http://example.com', 'hat:fedora', 'a:b;c:d', '']) {
    assert.equal(isValidToken(notAToken), false, `${JSON.stringify(notAToken)} was accepted`);
  }
});

test('a seed containing the separator cannot split its own token', () => {
  // Both CSS delimiters have to be escaped, or a seed could forge declarations.
  for (const seed of ['a;b', 'a;;b', ';', ':', 'a:b', 'monako:1;mood:happy', 'mood:happy']) {
    const token = toToken({ seed });
    assert.equal(token.split(';').length, 2, `${token} split into extra declarations`);
    assert.equal(traitsFromToken(token).seed, seed, `seed ${JSON.stringify(seed)} did not survive`);
  }
});
