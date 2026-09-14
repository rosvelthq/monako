import { ForwardRefExoticComponent, RefAttributes, CSSProperties } from 'react';
import { Monako } from './monako';

export type EmotionName =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'angry'
  | 'sleepy'
  | 'curious'
  | 'love';

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
  style?: CSSProperties;
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

export declare const MonakoFace: ForwardRefExoticComponent<
  MonakoProps & RefAttributes<MonakoRef>
>;
