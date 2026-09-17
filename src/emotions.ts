/**
 * Emotion definitions for Monako faces.
 * Each emotion defines eye shape, position, and animation parameters.
 */

import type { EmotionName } from './traits.js';

export interface EyeGeometry {
  /** Horizontal radius, as a fraction of the 100-unit viewBox. */
  rx: number;
  /** Vertical radius. */
  ry: number;
  /** Centre x. */
  cx: number;
  /** Centre y. */
  cy: number;
}

export interface EmotionConfig {
  leftEye: EyeGeometry;
  rightEye: EyeGeometry;
  /** How far the eyes travel when following the pointer. */
  lookRange: number;
  /** [min, max] milliseconds between blinks. */
  blinkInterval: readonly [number, number];
  /** Degrees the eyes rotate inward. */
  tiltAngle?: number;
  /** Degrees the eyes rotate outward. */
  droopAngle?: number;
  /**
   * Declared by 'happy' and 'love' but read by nothing — the renderer has
   * never implemented either. Left in place because removing them would be a
   * silent visual change to two emotions; implement or delete deliberately.
   */
  squint?: number;
  sparkle?: boolean;
}

export const emotions: Record<EmotionName, EmotionConfig> = {
  neutral: {
    leftEye: { rx: 0.12, ry: 0.22, cx: 0.35, cy: 0.42 },
    rightEye: { rx: 0.12, ry: 0.22, cx: 0.65, cy: 0.42 },
    lookRange: 0.08,
    blinkInterval: [2000, 5000],
  },
  happy: {
    leftEye: { rx: 0.13, ry: 0.18, cx: 0.35, cy: 0.45 },
    rightEye: { rx: 0.13, ry: 0.18, cx: 0.65, cy: 0.45 },
    lookRange: 0.06,
    blinkInterval: [1500, 3500],
    squint: 0.15,
  },
  sad: {
    leftEye: { rx: 0.11, ry: 0.2, cx: 0.35, cy: 0.4 },
    rightEye: { rx: 0.11, ry: 0.2, cx: 0.65, cy: 0.4 },
    lookRange: 0.04,
    blinkInterval: [3000, 6000],
    droopAngle: 15,
  },
  surprised: {
    leftEye: { rx: 0.14, ry: 0.26, cx: 0.35, cy: 0.4 },
    rightEye: { rx: 0.14, ry: 0.26, cx: 0.65, cy: 0.4 },
    lookRange: 0.1,
    blinkInterval: [4000, 7000],
  },
  angry: {
    leftEye: { rx: 0.12, ry: 0.16, cx: 0.35, cy: 0.44 },
    rightEye: { rx: 0.12, ry: 0.16, cx: 0.65, cy: 0.44 },
    lookRange: 0.05,
    blinkInterval: [2500, 4500],
    tiltAngle: -12,
  },
  sleepy: {
    leftEye: { rx: 0.12, ry: 0.1, cx: 0.35, cy: 0.45 },
    rightEye: { rx: 0.12, ry: 0.1, cx: 0.65, cy: 0.45 },
    lookRange: 0.03,
    blinkInterval: [1000, 2000],
    droopAngle: 5,
  },
  curious: {
    leftEye: { rx: 0.11, ry: 0.22, cx: 0.33, cy: 0.42 },
    rightEye: { rx: 0.13, ry: 0.24, cx: 0.67, cy: 0.4 },
    lookRange: 0.1,
    blinkInterval: [2000, 4000],
  },
  love: {
    leftEye: { rx: 0.13, ry: 0.2, cx: 0.35, cy: 0.43 },
    rightEye: { rx: 0.13, ry: 0.2, cx: 0.65, cy: 0.43 },
    lookRange: 0.05,
    blinkInterval: [1800, 3500],
    sparkle: true,
  },
};

export const defaultEmotion: EmotionName = 'neutral';
