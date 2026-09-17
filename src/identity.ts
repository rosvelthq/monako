/**
 * Face identity: turning a short string into a face, and a face back into a
 * short string.
 *
 * A token reads like a CSS rule — `key:value` declarations separated by `;` —
 * and the version is one of the declarations:
 *
 *   monako:1;seed:naoki-bot            → derived. Every trait comes from the
 *                                        seed. Nothing to store but the seed.
 *   monako:1;mood:happy;face:533483    → explicit. The user picked this.
 *   monako:1;seed:naoki-bot;mood:love  → derived base, explicit override.
 *   mood:happy                         → no version stated; assume the current
 *                                        one. Convenient by hand, never written.
 *
 * Design notes, because they are load-bearing:
 *
 * - Keys, not positions. `mood:happy` survives someone appending a trait or
 *   reordering the registry; a positional token does not.
 * - Defaults are omitted, so the common token stays short.
 * - Unknown keys are ignored and unknown values fall back to the seeded or
 *   default value, rather than throwing. A newer writer must be able to hand a
 *   token to an older reader without taking the page down. Structural garbage
 *   still throws.
 * - The hash runs over UTF-8 bytes so a backend in another language can derive
 *   the identical face from the identical seed.
 */

import {
  DEFAULTS,
  TOKEN_NAME,
  TOKEN_VERSION,
  TRAIT_SPECS,
  type MonakoOptions,
  type TraitField,
  type Traits,
} from './traits.js';

/**
 * CSS declaration punctuation: `;` between declarations, `:` between a key and
 * its value.
 *
 * Both survive a URL (they are sub-delimiters, legal in a path and a query) and
 * a text column, and `encodeURIComponent` escapes them to `%3B` and `%3A`, so a
 * seed containing either cannot split the token it sits in.
 */
const DECLARATION_SEPARATOR = ';';
const VALUE_SEPARATOR = ':';

/** Keys this build understands. Anything else in a token is ignored. */
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  TOKEN_NAME,
  'seed',
  ...TRAIT_SPECS.map((spec) => spec.key),
]);

const HEX_LONG = /^#?([0-9a-f]{6})$/i;
const HEX_SHORT = /^#?([0-9a-f]{3})$/i;

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

/**
 * FNV-1a, 32-bit, over the UTF-8 bytes of `str`.
 *
 * Not a cryptographic hash and not trying to be — it is a fast, stable,
 * dependency-free way to spread seeds evenly over a handful of buckets. The
 * only property that matters here is that it never changes.
 */
export function fnv1a(str: string): number {
  const bytes = encoder
    ? encoder.encode(str)
    : // Exotic runtimes without TextEncoder: fall back to code units. Only
      // differs from the UTF-8 path for non-ASCII seeds.
      Array.from(String(str), (c) => c.charCodeAt(0) & 0xff);

  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Pick one entry from a frozen registry for this seed.
 *
 * Each trait gets its own salt so that two traits drawn from lists of the same
 * length do not move in lockstep across seeds — without it, every face whose
 * shape is 'square' would always have the same eye style.
 *
 * The modulo introduces a bias of order 1e-9 for lists this small. Ignorable.
 */
function pick(seed: string, salt: string, list: readonly string[]): string {
  return list[fnv1a(`${salt}:${seed}`) % list.length]!;
}

/** Normalise a colour to `#rrggbb`, or return null if it is not a hex colour. */
function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();

  const long = HEX_LONG.exec(trimmed);
  if (long) return `#${long[1]!.toLowerCase()}`;

  const short = HEX_SHORT.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1]!.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return null;
}

/** A partial trait set, as a plain record keyed by trait field. */
type PartialTraits = Partial<Record<TraitField, string>>;

function withoutNullish(obj: Partial<Traits>): PartialTraits {
  const out: PartialTraits = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      out[key as TraitField] = value as string;
    }
  }
  return out;
}

/**
 * Derive a full set of traits from a seed.
 *
 * Deterministic and total: any string produces a valid face, and the same
 * string always produces the same face.
 */
export function traitsFromSeed(
  seed: string | number,
  overrides: Partial<Traits> = {},
): Traits {
  const key = String(seed);
  const traits: PartialTraits = {};

  for (const spec of TRAIT_SPECS) {
    traits[spec.field] = pick(key, spec.salt, spec.palette);
  }

  return { ...traits, ...withoutNullish(overrides) } as Traits;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A stray '%' is not worth failing a render over.
    return value;
  }
}

interface ParsedToken {
  seed: string | null;
  /** Only the traits the token actually states — never a defaults-filled set. */
  overrides: PartialTraits;
}

/**
 * Split a token into its seed and the traits it actually states.
 *
 * The distinction matters: `overrides` holds only the keys the token carries.
 * Layering a partial token over a seeded face has to leave the unmentioned
 * traits alone — filling the gaps with defaults first would wipe the seeded
 * identity and hand back a plain black circle.
 */
function parseToken(token: string): ParsedToken {
  if (typeof token !== 'string') {
    throw new TypeError(
      `Monako: token must be a string, received ${typeof token}`,
    );
  }

  const pairs: Record<string, string> = {};

  for (const declaration of token.trim().split(DECLARATION_SEPARATOR)) {
    const chunk = declaration.trim();
    if (chunk === '') continue;

    const split = chunk.indexOf(VALUE_SEPARATOR);
    if (split === -1) {
      throw new TypeError(
        `Monako: malformed token declaration "${chunk}" — expected "key${VALUE_SEPARATOR}value"`,
      );
    }

    pairs[chunk.slice(0, split).trim()] = chunk.slice(split + 1);
  }

  // The version declaration is optional on the way in: a hand-written token is
  // allowed to mean "whatever ships today". `toToken` always writes it, so
  // anything that reached a database is pinned.
  const declaredVersion = pairs[TOKEN_NAME];
  if (declaredVersion !== undefined && Number(declaredVersion) !== TOKEN_VERSION) {
    throw new TypeError(
      `Monako: token "${token}" declares ${TOKEN_NAME}${VALUE_SEPARATOR}${declaredVersion}, ` +
        `but this build only decodes version ${TOKEN_VERSION}`,
    );
  }

  // With the version optional, "key:value" alone is too loose a shape to
  // accept — 'http://example.com' parses as one. Demand at least one key this
  // build actually knows, so isValidToken can guard a database column.
  if (!Object.keys(pairs).some((key) => KNOWN_KEYS.has(key))) {
    throw new TypeError(
      `Monako: "${token}" is not a token — expected "${TOKEN_NAME}${VALUE_SEPARATOR}${TOKEN_VERSION}" ` +
        `or at least one of ${[...KNOWN_KEYS].join(', ')}`,
    );
  }

  const overrides: PartialTraits = {};

  for (const spec of TRAIT_SPECS) {
    const raw = pairs[spec.key];
    if (raw === undefined) continue;

    if (spec.kind === 'color') {
      const color = normalizeColor(raw);
      if (color !== null) overrides[spec.field] = color;
      continue;
    }

    // Unknown enum member: a newer writer knows something we do not. Leave the
    // key absent so the seeded or default value shows through, rather than
    // throwing.
    if (spec.palette.includes(raw)) overrides[spec.field] = raw;
  }

  return {
    seed: pairs.seed !== undefined ? safeDecode(pairs.seed) : null,
    overrides,
  };
}

/**
 * Resolve the traits described by a token, on its own.
 *
 * Gaps are filled from the token's own seed if it has one, and from the
 * defaults otherwise. To layer a token over a seed supplied separately, use
 * `resolveTraits` — this function cannot tell "unstated" from "default".
 *
 * Throws only when the token is structurally not a token. Unrecognised keys
 * and values degrade to the seeded or default value — see the header.
 */
export function traitsFromToken(token: string): Traits {
  const { seed, overrides } = parseToken(token);

  return (
    seed !== null
      ? { ...traitsFromSeed(seed), ...overrides, seed }
      : { ...DEFAULTS, ...overrides }
  ) as Traits;
}

/**
 * Serialise traits to a token.
 *
 * Only what is needed to reconstruct the face is written: the seed if there is
 * one, then any trait that differs from what the seed (or the defaults) would
 * already give you.
 *
 * @throws {TypeError} if a stated trait cannot be represented in a token — a
 *   non-hex colour, or a value outside its registry.
 */
export function toToken(
  traits: Partial<Traits> & { seed?: string | number | null } = {},
): string {
  const seed =
    traits.seed !== undefined && traits.seed !== null
      ? String(traits.seed)
      : null;
  const base: Record<string, string> = seed !== null
    ? (traitsFromSeed(seed) as unknown as Record<string, string>)
    : (DEFAULTS as unknown as Record<string, string>);

  const parts: string[] = [];
  if (seed !== null) {
    parts.push(`seed${VALUE_SEPARATOR}${encodeURIComponent(seed)}`);
  }

  for (const spec of TRAIT_SPECS) {
    const raw = (traits as Record<string, unknown>)[spec.field];

    // Absent is fine — that is what "this trait is whatever the base says"
    // looks like. Present but unrepresentable is not: quietly dropping it
    // would hand back a token that renders a different face than the one
    // being serialised, which is worse than failing here.
    if (raw === undefined || raw === null) continue;

    let value: string;
    if (spec.kind === 'color') {
      const color = normalizeColor(raw);
      if (color === null) {
        throw new TypeError(
          `Monako: cannot serialise ${spec.field} ${JSON.stringify(raw)} — a token ` +
            `holds hex colours only. Pass it as an explicit option instead.`,
        );
      }
      value = color;
    } else {
      value = raw as string;
      if (!spec.palette.includes(value)) {
        throw new TypeError(
          `Monako: cannot serialise ${spec.field} ${JSON.stringify(raw)} — ` +
            `expected one of ${spec.palette.join(', ')}.`,
        );
      }
    }

    if (value === base[spec.field]) continue;

    parts.push(
      `${spec.key}${VALUE_SEPARATOR}${spec.kind === 'color' ? value.slice(1) : value}`,
    );
  }

  // The version always leads, even when nothing else is stated, so a stored
  // token can never be reinterpreted by a later registry.
  return [`${TOKEN_NAME}${VALUE_SEPARATOR}${TOKEN_VERSION}`, ...parts].join(
    DECLARATION_SEPARATOR,
  );
}

/**
 * Whether `token` can be decoded. Useful for guarding a value read out of a
 * database column that anything could have written to.
 */
export function isValidToken(token: unknown): boolean {
  if (typeof token !== 'string') return false;
  try {
    traitsFromToken(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Work out the traits a set of constructor options describes.
 *
 * Precedence, weakest to strongest:
 *   defaults → seed derivation → token → explicit options
 *
 * A token contributes only the traits it names, so one customised trait never
 * costs you the rest of a derived face. A token carrying its own `seed:` is the
 * exception: that is a complete statement, and it re-bases everything.
 */
export function resolveTraits(options: MonakoOptions = {}): Traits {
  let traits: Record<string, string> = { ...(DEFAULTS as unknown as Record<string, string>) };

  if (options.seed !== undefined && options.seed !== null) {
    traits = {
      ...traits,
      ...(traitsFromSeed(options.seed) as unknown as Record<string, string>),
      seed: String(options.seed),
    };
  }

  if (options.token !== undefined && options.token !== null) {
    const { seed, overrides } = parseToken(options.token);

    // A token carrying its own seed re-bases the whole face on that seed; a
    // token without one contributes ONLY the traits it names, so the seed
    // above keeps supplying everything else.
    if (seed !== null) {
      traits = {
        ...traits,
        ...(traitsFromSeed(seed) as unknown as Record<string, string>),
        seed,
      };
    }

    traits = { ...traits, ...overrides };
  }

  for (const spec of TRAIT_SPECS) {
    const value = (options as Record<string, unknown>)[spec.field];
    if (value === undefined || value === null) continue;

    if (spec.kind === 'color') {
      const color = normalizeColor(value);
      // An explicit colour the library does not recognise as hex is still
      // passed through — 'rebeccapurple' and 'var(--brand)' are legal fills.
      traits[spec.field] = color !== null ? color : (value as string);
      continue;
    }

    if (spec.palette.includes(value as string)) {
      traits[spec.field] = value as string;
    }
  }

  return traits as unknown as Traits;
}
