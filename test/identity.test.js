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

const GOLDEN = {
  'naoki-bot': {
    shape: 'rounded',
    eyeStyle: 'none',
    emotion: 'surprised',
    color: '#00bfa7',
    eyeColor: '#ffe9a8',
  },
  '': {
    shape: 'rounded',
    eyeStyle: 'none',
    emotion: 'neutral',
    color: '#000000',
    eyeColor: '#ffffff',
  },
  '0': {
    shape: 'rounded',
    eyeStyle: 'pixel',
    emotion: 'neutral',
    color: '#000000',
    eyeColor: '#ffffff',
  },
  a: {
    shape: 'square',
    eyeStyle: 'pill',
    emotion: 'love',
    color: '#ff5900',
    eyeColor: '#c8f7ff',
  },
  'matth@rosvelt.com': {
    shape: 'drop',
    eyeStyle: 'pixel',
    emotion: 'neutral',
    color: '#9f6535',
    eyeColor: '#ffffff',
  },
  '01a04057-6fa0-7c71-9fb7-717d971cbb75': {
    shape: 'drop',
    eyeStyle: 'none',
    emotion: 'neutral',
    color: '#00bfa7',
    eyeColor: '#ffffff',
  },
  'ñandú 🦤': {
    shape: 'pill',
    eyeStyle: 'smooth',
    emotion: 'love',
    color: '#777777',
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
  const withSquare = [];
  for (let i = 0; i < 2000 && withSquare.length < 50; i++) {
    const traits = traitsFromSeed(`lockstep-${i}`);
    if (traits.shape === 'square') withSquare.push(traits.eyeStyle);
  }
  assert.ok(withSquare.length > 10, 'not enough samples');
  assert.ok(new Set(withSquare).size >= 2, 'at least some eye style variation per shape');
});

test('overrides win over the seed', () => {
  const traits = traitsFromSeed('naoki-bot', { emotion: 'love' });
  assert.equal(traits.emotion, 'love');
  assert.equal(traits.color, GOLDEN['naoki-bot'].color, 'untouched traits stay derived');
});

test('explicit traits round-trip', () => {
  const traits = {
    color: '#533483',
    eyeColor: '#ffe9a8',
    emotion: 'love',
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
  assert.equal(toToken({ emotion: 'love' }), 'monako:1;mood:love');
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

test('unknown keys are ignored', () => {
  const decoded = traitsFromToken('monako:1;mood:love;eyebrows:bushy;hat:fedora');
  assert.equal(decoded.emotion, 'love');
  assert.deepEqual(decoded, { ...DEFAULTS, emotion: 'love' });
});

test('unknown enum values fall back rather than throw', () => {
  assert.equal(traitsFromToken('monako:1;mood:wink').emotion, DEFAULTS.emotion);
  assert.equal(traitsFromToken('monako:1;shape:triangle').shape, DEFAULTS.shape);
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
  assert.throws(() => traitsFromToken('monako:2;mood:love'), TypeError);
  assert.throws(() => traitsFromToken('monako:1;moodlove'), TypeError);
  assert.throws(() => traitsFromToken(null), TypeError);
  assert.throws(() => traitsFromToken(42), TypeError);
});

test('isValidToken guards storage reads', () => {
  assert.equal(isValidToken('monako:1;mood:love'), true);
  assert.equal(isValidToken('monako:1'), true);
  assert.equal(isValidToken('monako:1;mood:wink'), true, 'forgiving values are still valid');
  assert.equal(isValidToken('sql injection'), false);
  assert.equal(isValidToken(null), false);
  assert.equal(isValidToken(undefined), false);
  assert.equal(isValidToken(''), false);
});

test('resolveTraits precedence: defaults < seed < token < explicit', () => {
  assert.deepEqual(resolveTraits({}), { ...DEFAULTS });

  assert.equal(resolveTraits({ seed: 'naoki-bot' }).emotion, GOLDEN['naoki-bot'].emotion);

  assert.equal(
    resolveTraits({ seed: 'naoki-bot', token: 'monako:1;mood:sad' }).emotion,
    'sad',
    'token beats seed',
  );

  assert.equal(
    resolveTraits({ seed: 'naoki-bot', token: 'monako:1;mood:sad', emotion: 'love' }).emotion,
    'love',
    'explicit beats token',
  );

  assert.equal(
    resolveTraits({ token: 'monako:1;seed:a', seed: 'b' }).color,
    traitsFromSeed('a').color,
    "a token's own seed beats the seed option",
  );
});

test('explicit non-hex colours pass through untouched', () => {
  assert.equal(resolveTraits({ color: 'rebeccapurple' }).color, 'rebeccapurple');
  assert.equal(resolveTraits({ color: 'var(--brand)' }).color, 'var(--brand)');
});

test('seed 0 is a seed, not an absence of one', () => {
  assert.deepEqual(resolveTraits({ seed: 0 }), { ...traitsFromSeed('0'), seed: '0' });
  assert.equal(resolveTraits({ seed: 0 }).seed, '0');
});

test('numeric and string seeds agree', () => {
  assert.deepEqual(
    { ...traitsFromSeed(42), seed: undefined },
    { ...traitsFromSeed('42'), seed: undefined },
  );
});

test('a partial token layers over a seed without wiping it', () => {
  const seeded = traitsFromSeed('naoki-bot');
  const resolved = resolveTraits({ seed: 'naoki-bot', token: 'monako:1;mood:love' });

  assert.equal(resolved.emotion, 'love', 'the token trait applies');
  assert.equal(resolved.shape, seeded.shape, 'shape stays seeded');
  assert.equal(resolved.eyeStyle, seeded.eyeStyle, 'eyeStyle stays seeded');
  assert.equal(resolved.color, seeded.color, 'colour stays seeded');
  assert.equal(resolved.eyeColor, seeded.eyeColor, 'eyeColor stays seeded');
  assert.equal(resolved.seed, 'naoki-bot');

  assert.deepEqual(resolved, { ...seeded, emotion: 'love', seed: 'naoki-bot' });
});

test('an empty token over a seed changes nothing', () => {
  assert.deepEqual(
    resolveTraits({ seed: 'naoki-bot', token: 'monako:1' }),
    { ...traitsFromSeed('naoki-bot'), seed: 'naoki-bot' },
  );
});

test('a token with its own seed re-bases the whole face', () => {
  assert.deepEqual(
    resolveTraits({ seed: 'ignored', token: 'monako:1;seed:naoki-bot' }),
    { ...traitsFromSeed('naoki-bot'), seed: 'naoki-bot' },
  );
});

test('toToken refuses to silently drop what it cannot represent', () => {
  assert.throws(
    () => toToken({ color: 'rebeccapurple', emotion: 'love' }),
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
    () => toToken({ shape: 'triangle' }),
    /expected one of circle, square, rounded, blob, drop, pill/,
  );
});

test('toToken still ignores traits that are simply absent', () => {
  assert.equal(toToken({ emotion: 'love' }), 'monako:1;mood:love');
  assert.equal(toToken({ emotion: 'love', color: undefined }), 'monako:1;mood:love');
  assert.equal(toToken({ emotion: 'love', color: null }), 'monako:1;mood:love');
});

test('a token is CSS declaration syntax', () => {
  assert.equal(toToken({}), 'monako:1');
  assert.equal(toToken({ seed: 'x' }), 'monako:1;seed:x');
  assert.equal(
    toToken({ emotion: 'love', shape: 'square', color: '#533483' }),
    'monako:1;shape:square;mood:love;face:533483',
  );

  for (const token of ['monako:1', 'monako:1;seed:x', 'monako:1;shape:square;mood:love']) {
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
  assert.equal(traitsFromToken('mood:love').emotion, 'love');
  assert.equal(traitsFromToken('monako:1;mood:love').emotion, 'love');
  assert.deepEqual(traitsFromToken('mood:love'), traitsFromToken('monako:1;mood:love'));

  for (const traits of [{}, { seed: 'x' }, { emotion: 'love' }]) {
    assert.ok(toToken(traits).startsWith('monako:1'), 'every written token pins its version');
  }
});

test('a future version is refused rather than guessed at', () => {
  assert.throws(() => traitsFromToken('monako:2;mood:love'), /only decodes version 1/);
  assert.equal(isValidToken('monako:2;mood:love'), false);
});

test('a string that merely contains a colon is not a token', () => {
  for (const notAToken of ['http://example.com', 'hat:fedora', 'a:b;c:d', '']) {
    assert.equal(isValidToken(notAToken), false, `${JSON.stringify(notAToken)} was accepted`);
  }
});

test('a seed containing the separator cannot split its own token', () => {
  for (const seed of ['a;b', 'a;;b', ';', ':', 'a:b', 'monako:1;mood:love', 'mood:love']) {
    const token = toToken({ seed });
    assert.equal(token.split(';').length, 2, `${token} split into extra declarations`);
    assert.equal(traitsFromToken(token).seed, seed, `seed ${JSON.stringify(seed)} did not survive`);
  }
});
