export interface MonakoOptions {
  /** Size in pixels (default: 100) */
  size?: number;
  /** Face color (default: '#000000') */
  color?: string;
  /** Eye color (default: '#ffffff') */
  eyeColor?: string;
  /** Initial emotion (default: 'neutral') */
  emotion?: EmotionName;
  /** Follow cursor movement (default: true) */
  followCursor?: boolean;
  /** Auto animate eyes and blink (default: true) */
  autoAnimate?: boolean;
  /** Container element or selector */
  container?: HTMLElement | string | null;
  /** Seed for reproducible random generation */
  seed?: number | null;
}

export type EmotionName =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'angry'
  | 'sleepy'
  | 'curious'
  | 'love';

export interface EmotionConfig {
  leftEye: EyeConfig;
  rightEye: EyeConfig;
  lookRange: number;
  blinkInterval: [number, number];
  squint?: number;
  droopAngle?: number;
  tiltAngle?: number;
  sparkle?: boolean;
}

export interface EyeConfig {
  rx: number;
  ry: number;
  cx: number;
  cy: number;
}

export declare class Monako {
  constructor(options?: MonakoOptions);

  /** Set the emotion */
  setEmotion(emotion: EmotionName): void;

  /** Get available emotions */
  static getEmotions(): EmotionName[];

  /** Set a random emotion */
  randomEmotion(): void;

  /** Make the face look at a specific point (0-1 range) */
  lookAt(x: number, y: number): void;

  /** Trigger a blink */
  blink(): void;

  /** Set face color */
  setColor(color: string): void;

  /** Set eye color */
  setEyeColor(color: string): void;

  /** Set size in pixels */
  setSize(size: number): void;

  /** Get the SVG element */
  getElement(): SVGElement;

  /** Export as SVG string */
  toSVG(): string;

  /** Export as data URL */
  toDataURL(): string;

  /** Destroy the instance and cleanup */
  destroy(): void;
}

export declare const emotions: Record<EmotionName, EmotionConfig>;

export declare function createMonako(options?: MonakoOptions): Monako;

export declare function createMany(count: number, baseOptions?: MonakoOptions): Monako[];

export default Monako;
