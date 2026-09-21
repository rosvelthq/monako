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
  sparkle?: boolean;
}

export const emotions: Record<EmotionName, EmotionConfig> = {
  neutral: {
    leftEye: { rx: 0.14, ry: 0.26, cx: 0.35, cy: 0.42 },
    rightEye: { rx: 0.14, ry: 0.26, cx: 0.65, cy: 0.42 },
    lookRange: 0.08,
    blinkInterval: [2000, 5000],
  },
  sad: {
    // Eyes lower on face, drooping
    leftEye: { rx: 0.11, ry: 0.18, cx: 0.38, cy: 0.52 },
    rightEye: { rx: 0.11, ry: 0.18, cx: 0.62, cy: 0.52 },
    lookRange: 0.03,
    blinkInterval: [3000, 6000],
    droopAngle: 18,
  },
  surprised: {
    // Much bigger eyes
    leftEye: { rx: 0.16, ry: 0.30, cx: 0.35, cy: 0.40 },
    rightEye: { rx: 0.16, ry: 0.30, cx: 0.65, cy: 0.40 },
    lookRange: 0.12,
    blinkInterval: [4000, 7000],
  },
  love: {
    // Big dreamy eyes
    leftEye: { rx: 0.15, ry: 0.28, cx: 0.35, cy: 0.42 },
    rightEye: { rx: 0.15, ry: 0.28, cx: 0.65, cy: 0.42 },
    lookRange: 0.05,
    blinkInterval: [1800, 3500],
    sparkle: true,
  },
};

export const defaultEmotion: EmotionName = 'neutral';
