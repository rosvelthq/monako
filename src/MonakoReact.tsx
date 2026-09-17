import {
  useEffect,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Monako } from './Monako.js';
import { resolveTraits } from './identity.js';
import type { EmotionName, ShapeName, EyeStyleName, Traits } from './traits.js';

export type { EmotionName, ShapeName, EyeStyleName, Traits };

export interface MonakoProps {
  /** Size in pixels (default: 100) */
  size?: number;
  /** Face color (default: '#000000', or derived from `seed`/`token`) */
  color?: string;
  /** Eye color (default: '#ffffff', or derived from `seed`/`token`) */
  eyeColor?: string;
  /** Emotion (default: 'neutral', or derived from `seed`/`token`) */
  emotion?: EmotionName;
  /** Face shape (default: 'circle', or derived from `seed`/`token`) */
  shape?: ShapeName;
  /** Eye style: smooth (ellipse) or pixel (rect) (default: 'smooth') */
  eyeStyle?: EyeStyleName;
  /** Follow cursor movement (default: true) */
  followCursor?: boolean;
  /** Auto animate eyes and blink (default: true) */
  autoAnimate?: boolean;
  /**
   * Derives every trait not passed explicitly, and seeds the blink rhythm.
   * The same seed always renders the same face — pass a stable id and you get
   * a consistent avatar with nothing to store.
   */
  seed?: string | number | null;
  /**
   * A `monako:1` token, as produced by `Monako.toToken()`. Takes precedence over
   * `seed`; explicit trait props still win over both.
   *
   * Unlike the `Monako` class, a token this component cannot parse does not
   * throw — it warns and falls back, because this value usually arrives from a
   * database and a bad row should not blank the page.
   */
  token?: string | null;
  /** Additional class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Tokens we have already complained about.
 *
 * A broken token usually comes from a database row, which means it arrives on
 * every render of every list that includes it. Warn once per distinct value so
 * the signal survives; no `process.env` check, because this build also runs in
 * browsers that have no `process` at all.
 */
const warned = new Set<string>();

function warnOnce(token: string | null, error: unknown): void {
  const key = String(token);
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[monako] ignoring unusable token ${JSON.stringify(token)}:`,
    error instanceof Error ? error.message : error
  );
}

export interface MonakoRef {
  /** Set the emotion */
  setEmotion: (emotion: EmotionName) => void;
  /** Set a random emotion */
  randomEmotion: () => void;
  /** Trigger a blink */
  blink: () => void;
  /** Make the face look at a specific point (0-1 range) */
  lookAt: (x: number, y: number) => void;
  /** Set face color */
  setColor: (color: string) => void;
  /** Set eye color */
  setEyeColor: (color: string) => void;
  /** Set face shape */
  setShape: (shape: ShapeName) => void;
  /** Set eye style */
  setEyeStyle: (style: EyeStyleName) => void;
  /** Current traits, including any changed through the ref */
  getTraits: () => Traits | null;
  /** Current traits as a `monako:1` token */
  toToken: () => string | null;
  /** Get the underlying Monako instance */
  getInstance: () => Monako | null;
}

/**
 * React component wrapper for Monako
 */
export const MonakoFace = forwardRef<MonakoRef, MonakoProps>(
  (
    {
      size = 100,
      // No defaults on the five trait props: leaving them undefined is what
      // lets `seed` and `token` supply them. `resolveTraits` fills the gaps.
      color,
      eyeColor,
      emotion,
      shape,
      eyeStyle,
      followCursor = true,
      autoAnimate = true,
      seed = null,
      token = null,
      className,
      style,
      onClick,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<Monako | null>(null);

    const traits = useMemo<Traits>(() => {
      try {
        return resolveTraits({
          seed,
          token,
          color,
          eyeColor,
          emotion,
          shape,
          eyeStyle,
        });
      } catch (error) {
        warnOnce(token, error);
        return resolveTraits({
          seed,
          color,
          eyeColor,
          emotion,
          shape,
          eyeStyle,
        });
      }
    }, [seed, token, color, eyeColor, emotion, shape, eyeStyle]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      setEmotion: (e) => instanceRef.current?.setEmotion(e),
      randomEmotion: () => instanceRef.current?.randomEmotion(),
      blink: () => instanceRef.current?.blink(),
      lookAt: (x, y) => instanceRef.current?.lookAt(x, y),
      setColor: (c) => instanceRef.current?.setColor(c),
      setEyeColor: (c) => instanceRef.current?.setEyeColor(c),
      setShape: (s) => instanceRef.current?.setShape(s),
      setEyeStyle: (s) => instanceRef.current?.setEyeStyle(s),
      getTraits: () => instanceRef.current?.getTraits() ?? null,
      toToken: () => instanceRef.current?.toToken() ?? null,
      getInstance: () => instanceRef.current,
    }));

    // Initialize Monako
    useEffect(() => {
      if (!containerRef.current || instanceRef.current) return;

      instanceRef.current = new Monako({
        container: containerRef.current,
        size,
        followCursor,
        autoAnimate,
        seed,
        ...traits,
      });

      return () => {
        instanceRef.current?.destroy();
        instanceRef.current = null;
      };
      // Mount only. Every trait below has its own effect, so the instance is
      // updated in place rather than torn down and rebuilt on each change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update size
    useEffect(() => {
      instanceRef.current?.setSize(size);
    }, [size]);

    // Update color
    useEffect(() => {
      instanceRef.current?.setColor(traits.color);
    }, [traits.color]);

    // Update eye color
    useEffect(() => {
      instanceRef.current?.setEyeColor(traits.eyeColor);
    }, [traits.eyeColor]);

    // Update emotion
    useEffect(() => {
      instanceRef.current?.setEmotion(traits.emotion);
    }, [traits.emotion]);

    // Update shape
    useEffect(() => {
      instanceRef.current?.setShape(traits.shape);
    }, [traits.shape]);

    // Update eye style
    useEffect(() => {
      instanceRef.current?.setEyeStyle(traits.eyeStyle);
    }, [traits.eyeStyle]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ display: 'inline-block', lineHeight: 0, ...style }}
        onClick={onClick}
      />
    );
  }
);

MonakoFace.displayName = 'MonakoFace';
