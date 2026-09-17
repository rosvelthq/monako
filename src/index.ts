import { Monako } from './Monako.js';
import { emotions } from './emotions.js';
import type { MonakoOptions } from './traits.js';

export { Monako, emotions };
export type {
  EmotionName,
  TraitSpec,
  EyeStyleName,
  MonakoOptions,
  ShapeName,
  TraitField,
  Traits,
} from './traits.js';
export type { EmotionConfig, EyeGeometry } from './emotions.js';

export {
  TOKEN_NAME,
  TOKEN_VERSION,
  EMOTIONS,
  SHAPES,
  EYE_STYLES,
  FACE_PALETTE,
  EYE_PALETTE,
  DEFAULTS,
  TRAIT_SPECS,
} from './traits.js';

export {
  fnv1a,
  isValidToken,
  resolveTraits,
  toToken,
  traitsFromSeed,
  traitsFromToken,
} from './identity.js';

/**
 * Create a Monako face.
 *
 * @param {import('./types.js').MonakoOptions} [options]
 * @returns {Monako}
 */
export function createMonako(options?: MonakoOptions): Monako {
  return new Monako(options);
}

/**
 * Create several faces that actually look different from one another.
 *
 * Each face is seeded with `${seed}#${i}`, so the set is reproducible as a
 * whole: the same base seed always yields the same faces in the same order.
 *
 * (Before seeds drove appearance this returned `count` identical faces that
 * merely blinked out of step, which was not much of a set.)
 *
 * @param {number} count
 * @param {import('./types.js').MonakoOptions} [baseOptions]
 * @returns {Monako[]}
 */
export function createMany(count: number, baseOptions: MonakoOptions = {}): Monako[] {
  // A token pins one exact face, and tokens beat seeds — leaving it in would
  // hand back `count` copies of it, which is the opposite of the point.
  const { seed, token: _ignoredToken, ...options } = baseOptions;

  // With a base seed the batch is fully reproducible. Without one, each call
  // gets a fresh base, so `createMany(5)` keeps meaning "five random faces"
  // rather than always returning the same five.
  const base = seed ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

  const faces: Monako[] = [];
  for (let i = 0; i < count; i++) {
    faces.push(new Monako({ ...options, seed: `${base}#${i}` }));
  }

  return faces;
}

// Default export for convenience
export default Monako;
