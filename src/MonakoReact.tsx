import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Monako } from './Monako.js';
import type { EmotionName } from './emotions.js';

export type ShapeName = 'circle' | 'square' | 'rounded';

export interface MonakoProps {
  /** Size in pixels (default: 100) */
  size?: number;
  /** Face color (default: '#000000') */
  color?: string;
  /** Eye color (default: '#ffffff') */
  eyeColor?: string;
  /** Emotion (default: 'neutral') */
  emotion?: EmotionName;
  /** Face shape (default: 'circle') */
  shape?: ShapeName;
  /** Follow cursor movement (default: true) */
  followCursor?: boolean;
  /** Auto animate eyes and blink (default: true) */
  autoAnimate?: boolean;
  /** Seed for reproducible faces */
  seed?: number | null;
  /** Additional class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Click handler */
  onClick?: () => void;
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
  /** Get the underlying Monako instance */
  getInstance: () => Monako | null;
}

export type { EmotionName };

/**
 * React component wrapper for Monako
 */
export const MonakoFace = forwardRef<MonakoRef, MonakoProps>(
  (
    {
      size = 100,
      color = '#000000',
      eyeColor = '#ffffff',
      emotion = 'neutral',
      shape = 'circle',
      followCursor = true,
      autoAnimate = true,
      seed = null,
      className,
      style,
      onClick,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<Monako | null>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      setEmotion: (e) => instanceRef.current?.setEmotion(e),
      randomEmotion: () => instanceRef.current?.randomEmotion(),
      blink: () => instanceRef.current?.blink(),
      lookAt: (x, y) => instanceRef.current?.lookAt(x, y),
      setColor: (c) => instanceRef.current?.setColor(c),
      setEyeColor: (c) => instanceRef.current?.setEyeColor(c),
      setShape: (s) => instanceRef.current?.setShape(s),
      getInstance: () => instanceRef.current,
    }));

    // Initialize Monako
    useEffect(() => {
      if (!containerRef.current || instanceRef.current) return;

      instanceRef.current = new Monako({
        container: containerRef.current,
        size,
        color,
        eyeColor,
        emotion,
        shape,
        followCursor,
        autoAnimate,
        seed,
      });

      return () => {
        instanceRef.current?.destroy();
        instanceRef.current = null;
      };
    }, []);

    // Update size
    useEffect(() => {
      instanceRef.current?.setSize(size);
    }, [size]);

    // Update color
    useEffect(() => {
      instanceRef.current?.setColor(color);
    }, [color]);

    // Update eye color
    useEffect(() => {
      instanceRef.current?.setEyeColor(eyeColor);
    }, [eyeColor]);

    // Update emotion
    useEffect(() => {
      instanceRef.current?.setEmotion(emotion);
    }, [emotion]);

    // Update shape
    useEffect(() => {
      instanceRef.current?.setShape(shape);
    }, [shape]);

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
