/**
 * FROZEN TRAIT REGISTRY — token version 1
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  READ THIS BEFORE EDITING ANY ARRAY IN THIS FILE.                    │
 * │                                                                      │
 * │  These lists are part of the wire format. A seed is turned into a    │
 * │  face by indexing into them, so their CONTENTS and LENGTH decide     │
 * │  what every stored seed renders as, forever.                         │
 * │                                                                      │
 * │  ALLOWED:  appending a new entry at the END of a list.               │
 * │            (changes only faces that hash onto the new slot)          │
 * │                                                                      │
 * │  FORBIDDEN: reordering, removing, or renaming an entry.              │
 * │            Every one of those silently rewrites faces that are       │
 * │            already saved in somebody's database.                     │
 * │                                                                      │
 * │  If you truly need to reorder or remove: leave version 1 alone, add  │
 * │  a version 2 registry beside it, and keep decoding version 1 tokens  │
 * │  with the version 1 lists.                                           │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Note that appending is only *mostly* safe: it shifts the modulo, so some
 * seeds will land on a different entry. Append deliberately, not casually.
 */

/**
 * The token's reserved key and its current version.
 *
 * A token is CSS-shaped — `key:value` declarations separated by `;` — and the
 * version is just one more declaration:
 *
 *   monako:1;shape:circle;mood:happy
 *
 * Reading a token with no `monako:` declaration assumes the current version.
 * Writing one always emits it: a stored token that does not pin its version
 * gets reinterpreted by whatever ships next, and the whole point of the
 * frozen registries is that a saved face never changes under its owner.
 */
export const TOKEN_NAME = 'monako';

export const TOKEN_VERSION = 1;

/** Emotions, in registry order. Mirrors the keys of `emotions.ts`. */
export const EMOTIONS = Object.freeze([
  'neutral',
  'happy',
  'sad',
  'surprised',
  'angry',
  'sleepy',
  'curious',
  'love',
] as const);

/** Face shapes, in registry order. */
export const SHAPES = Object.freeze(['circle', 'square', 'rounded'] as const);

/** Eye rendering styles, in registry order. */
export const EYE_STYLES = Object.freeze(['smooth', 'pixel'] as const);

/**
 * The literal unions every other module types against.
 *
 * Derived from the arrays rather than written out beside them: in TypeScript
 * the registry can be the single source of truth, so adding an emotion to the
 * list above is the only edit needed.
 */
export type EmotionName = (typeof EMOTIONS)[number];
export type ShapeName = (typeof SHAPES)[number];
export type EyeStyleName = (typeof EYE_STYLES)[number];

/**
 * Face colours a seed can land on.
 *
 * The first six entries are the palette the Naoki agent picker ships, in its
 * order — keep them where they are so hand-picked and seeded faces draw from
 * the same well. All entries are mid-to-dark so light eyes always contrast.
 */
export const FACE_PALETTE = Object.freeze([
  '#000000',
  '#1a1a2e',
  '#533483',
  '#e94560',
  '#2980b9',
  '#27ae60',
  '#c0392b',
  '#8e44ad',
  '#16a085',
  '#d35400',
  '#2c3e50',
  '#7f8c8d',
] as const);

/**
 * Eye colours a seed can land on. Deliberately all light: the face palette is
 * dark, and an avatar whose eyes vanish into its head is a bug, not a variant.
 */
export const EYE_PALETTE = Object.freeze([
  '#ffffff',
  '#f4f1de',
  '#ffe9a8',
  '#c8f7ff',
] as const);

/**
 * Everything that decides how a face looks. Nothing here is about behaviour —
 * `size`, `followCursor` and friends are presentation, not identity, and a
 * token never carries them.
 */
export interface Traits {
  /** Face fill, `#rrggbb`. */
  color: string;
  /** Eye fill, `#rrggbb`. */
  eyeColor: string;
  emotion: EmotionName;
  shape: ShapeName;
  eyeStyle: EyeStyleName;
  /** Present when the traits were derived from a seed. */
  seed?: string;
}

/**
 * What a face looks like with no seed, no token and no explicit options.
 * Any trait equal to its default is omitted when serialising a token.
 */
export const DEFAULTS: Readonly<Omit<Traits, 'seed'>> = Object.freeze({
  color: '#000000',
  eyeColor: '#ffffff',
  emotion: 'neutral',
  shape: 'circle',
  eyeStyle: 'smooth',
});

/** The trait fields a token can carry, i.e. everything but `seed`. */
export type TraitField = keyof Omit<Traits, 'seed'>;

export interface TraitSpec {
  /** The token key. Public surface — renaming one is a breaking change. */
  readonly key: string;
  /** The field on `Traits` this key maps to. */
  readonly field: TraitField;
  /** The frozen list a seed picks from. */
  readonly palette: readonly string[];
  /** 'enum' values must be registry members; 'color' values are hex. */
  readonly kind: 'enum' | 'color';
  /** Keeps each trait's hash stream independent of the others. */
  readonly salt: string;
}

/**
 * Token key ⇄ trait field, plus the registry each trait is drawn from.
 *
 * The short keys are the token's public surface: `mood:happy` rather than
 * `emotion:happy`, so a token stays legible at a glance in a database row.
 */
export const TRAIT_SPECS: readonly TraitSpec[] = Object.freeze([
  { key: 'shape', field: 'shape', palette: SHAPES, kind: 'enum', salt: 'shape' },
  { key: 'eyes', field: 'eyeStyle', palette: EYE_STYLES, kind: 'enum', salt: 'eyes' },
  { key: 'mood', field: 'emotion', palette: EMOTIONS, kind: 'enum', salt: 'mood' },
  { key: 'face', field: 'color', palette: FACE_PALETTE, kind: 'color', salt: 'face' },
  { key: 'iris', field: 'eyeColor', palette: EYE_PALETTE, kind: 'color', salt: 'iris' },
] as const);

/**
 * Options accepted by the `Monako` constructor.
 */
export interface MonakoOptions extends Partial<Omit<Traits, 'seed'>> {
  /** Rendered size in pixels. */
  size?: number;
  /** Track the pointer with the eyes. */
  followCursor?: boolean;
  /** Run the blink and look loops. */
  autoAnimate?: boolean;
  /** Mount point, or a selector. */
  container?: Element | string | null;
  /**
   * Derives every trait not given explicitly, and seeds the blink rhythm.
   * The same seed always gives the same face.
   */
  seed?: string | number | null;
  /**
   * A `monako:1` token. Overrides `seed`, is overridden by explicit traits.
   */
  token?: string | null;
}
