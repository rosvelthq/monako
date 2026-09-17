import { emotions } from './emotions.js';
import { EMOTIONS, SHAPES, EYE_STYLES } from './traits.js';
import {
  fnv1a,
  isValidToken,
  resolveTraits,
  toToken,
  traitsFromSeed,
  traitsFromToken,
} from './identity.js';
import type { EmotionConfig, EyeGeometry } from './emotions.js';
import type {
  EmotionName,
  EyeStyleName,
  MonakoOptions,
  ShapeName,
  Traits,
} from './traits.js';

interface Point {
  x: number;
  y: number;
}

/** Everything the instance keeps: the resolved traits plus presentation. */
interface ResolvedOptions {
  size: number;
  color: string;
  eyeColor: string;
  emotion: EmotionName;
  shape: ShapeName;
  eyeStyle: EyeStyleName;
  followCursor: boolean;
  autoAnimate: boolean;
  container: Element | string | null;
  seed: string | number | null;
}

/**
 * Monako - Animated face with expressive eyes
 */
export class Monako {
  /** Resolved traits plus the presentation options, as one live record. */
  readonly options: ResolvedOptions;

  private currentEmotion: EmotionConfig;
  private lookOffset: Point;
  private targetLook: Point;
  private blinkState: number;
  private isBlinking: boolean;
  private animationId: number | null;
  private blinkTimeoutId: ReturnType<typeof setTimeout> | null;
  private element!: SVGSVGElement;
  private leftEyeEl: SVGElement | null;
  private rightEyeEl: SVGElement | null;
  private random: () => number;
  private cleanupCursor?: () => void;

  constructor(options: MonakoOptions = {}) {
    // `seed` and `token` collapse into concrete traits here, so everything
    // below this line only ever deals with colours and names.
    const traits = resolveTraits(options);

    this.options = {
      size: options.size || 100,
      color: traits.color,
      eyeColor: traits.eyeColor,
      emotion: traits.emotion,
      shape: traits.shape,
      eyeStyle: traits.eyeStyle,
      followCursor: options.followCursor ?? true,
      autoAnimate: options.autoAnimate ?? true,
      container: options.container ?? null,
      // `??`, not `||`: 0 is a legitimate seed, and `|| null` quietly threw it
      // away, falling back to Math.random and un-reproducing the face.
      seed: traits.seed ?? options.seed ?? null,
    };

    this.currentEmotion = emotions[this.options.emotion] ?? emotions.neutral;
    this.lookOffset = { x: 0, y: 0 };
    this.targetLook = { x: 0, y: 0 };
    this.blinkState = 0;
    this.isBlinking = false;
    this.animationId = null;
    this.blinkTimeoutId = null;
    this.leftEyeEl = null;
    this.rightEyeEl = null;
    this.random = this.createRandom(this.options.seed);

    this.init();
  }

  private createFaceShape(ns: string): SVGElement {
    const shape = this.options.shape;

    if (shape === 'circle') {
      const circle = document.createElementNS(ns, 'circle') as SVGElement;
      circle.setAttribute('cx', '50');
      circle.setAttribute('cy', '50');
      circle.setAttribute('r', '48');
      return circle;
    }

    if (shape === 'square') {
      const rect = document.createElementNS(ns, 'rect') as SVGElement;
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '2');
      rect.setAttribute('width', '96');
      rect.setAttribute('height', '96');
      return rect;
    }

    // 'rounded' (default fallback)
    const rect = document.createElementNS(ns, 'rect') as SVGElement;
    rect.setAttribute('x', '2');
    rect.setAttribute('y', '2');
    rect.setAttribute('width', '96');
    rect.setAttribute('height', '96');
    rect.setAttribute('rx', '20');
    rect.setAttribute('ry', '20');
    return rect;
  }

  /**
   * Build the PRNG that drives blink rhythm and `randomEmotion()`.
   *
   * This is *not* what decides how the face looks — appearance is resolved from
   * the seed up front by `resolveTraits`. This only makes the animation
   * reproducible too.
   *
   * @param {string | number | null} seed
   * @returns {() => number}
   */
  private createRandom(seed: string | number | null): () => number {
    if (seed === null || seed === undefined) {
      return Math.random;
    }

    // Any seed shape folds to 32 bits, so strings work as well as numbers.
    let s = typeof seed === 'number' ? seed >>> 0 : fnv1a(String(seed));

    // An LCG sitting on 0 with these constants is fine, but a zero seed is a
    // suspiciously common accident; nudge it somewhere less degenerate.
    if (s === 0) s = 0x9e3779b9;

    return () => {
      // Math.imul keeps the multiply exact in 32 bits. Plain `*` overflows
      // double precision for large seeds and silently drops low bits.
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      return s / 0x100000000;
    };
  }

  private init(): void {
    this.element = this.createSVG();

    if (this.options.container) {
      const container = typeof this.options.container === 'string'
        ? document.querySelector(this.options.container)
        : this.options.container;

      if (container) {
        container.appendChild(this.element);
      }
    }

    if (this.options.followCursor) {
      this.setupCursorTracking();
    }

    if (this.options.autoAnimate) {
      this.startAnimation();
      this.scheduleBlink();
    }
  }

  private createSVG(): SVGSVGElement {
    const size = this.options.size;
    const ns = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(ns, 'svg') as SVGSVGElement;
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 100 100');
    if (this.options.eyeStyle === 'pixel') {
      svg.setAttribute('shape-rendering', 'crispEdges');
    }
    svg.style.display = 'block';

    // Face shape
    const face = this.createFaceShape(ns);
    face.setAttribute('fill', String(this.options.color));
    face.setAttribute('class', 'monako-face');
    svg.appendChild(face);

    // Eye container group
    const eyeGroup = document.createElementNS(ns, 'g') as SVGElement;
    eyeGroup.setAttribute('class', 'monako-eyes');

    // Left eye
    this.leftEyeEl = this.createEye(ns, 'left');
    eyeGroup.appendChild(this.leftEyeEl);

    // Right eye
    this.rightEyeEl = this.createEye(ns, 'right');
    eyeGroup.appendChild(this.rightEyeEl);

    svg.appendChild(eyeGroup);

    return svg;
  }

  private createEye(ns: string, side: 'left' | 'right'): SVGElement {
    const eyeData = side === 'left'
      ? this.currentEmotion.leftEye
      : this.currentEmotion.rightEye;

    if (this.options.eyeStyle === 'pixel') {
      return this.createPixelEye(ns, eyeData);
    }

    const eye = document.createElementNS(ns, 'ellipse') as SVGElement;
    eye.setAttribute('cx', String(eyeData.cx * 100));
    eye.setAttribute('cy', String(eyeData.cy * 100));
    eye.setAttribute('rx', String(eyeData.rx * 100));
    eye.setAttribute('ry', String(eyeData.ry * 100));
    eye.setAttribute('fill', String(this.options.eyeColor));
    eye.style.transition = 'rx 0.1s ease, ry 0.1s ease';

    // Apply emotion-specific transforms
    // Both angles compose onto one `transform`. Writing them as two separate
    // setAttribute calls meant the second silently replaced the first; no
    // shipped emotion sets both, so this was latent rather than visible.
    const transforms = [];
    const pivot = `${eyeData.cx * 100} ${eyeData.cy * 100}`;

    if (this.currentEmotion.tiltAngle) {
      const tilt = side === 'left'
        ? -this.currentEmotion.tiltAngle
        : this.currentEmotion.tiltAngle;
      transforms.push(`rotate(${tilt} ${pivot})`);
    }

    if (this.currentEmotion.droopAngle) {
      const droop = side === 'left'
        ? this.currentEmotion.droopAngle
        : -this.currentEmotion.droopAngle;
      transforms.push(`rotate(${droop} ${pivot})`);
    }

    if (transforms.length > 0) {
      eye.setAttribute('transform', String(transforms.join(' ')));
    }

    return eye;
  }

  private createPixelEye(ns: string, eyeData: EyeGeometry): SVGElement {
    // Pixel eyes: simple rectangles
    const eye = document.createElementNS(ns, 'rect') as SVGElement;
    const w = eyeData.rx * 100 * 1.4; // width
    const h = eyeData.ry * 100 * 1.6; // height
    const cx = eyeData.cx * 100;
    const cy = eyeData.cy * 100;

    eye.setAttribute('x', String(cx - w / 2));
    eye.setAttribute('y', String(cy - h / 2));
    eye.setAttribute('width', String(w));
    eye.setAttribute('height', String(h));
    eye.setAttribute('fill', String(this.options.eyeColor));
    eye.setAttribute('data-cx', String(cx));
    eye.setAttribute('data-cy', String(cy));
    eye.setAttribute('data-w', String(w));
    eye.setAttribute('data-h', String(h));

    return eye;
  }

  private setupCursorTracking(): void {
    const onMouseMove = (e: MouseEvent): void => {
      if (!this.element) return;

      const rect = this.element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      const maxDistance = Math.max(window.innerWidth, window.innerHeight);
      const range = this.currentEmotion.lookRange;
      this.targetLook.x = (deltaX / maxDistance) * range * 100 * 2;
      this.targetLook.y = (deltaY / maxDistance) * range * 100 * 2;
    };

    document.addEventListener('mousemove', onMouseMove);
    this.cleanupCursor = () => document.removeEventListener('mousemove', onMouseMove);
  }

  private startAnimation(): void {
    const animate = () => {
      // Smooth eye movement
      this.lookOffset.x += (this.targetLook.x - this.lookOffset.x) * 0.1;
      this.lookOffset.y += (this.targetLook.y - this.lookOffset.y) * 0.1;

      this.updateEyes();
      this.animationId = requestAnimationFrame(animate);
    };

    animate();
  }

  private updateEyes(): void {
    if (!this.leftEyeEl || !this.rightEyeEl) return;

    if (this.options.eyeStyle === 'pixel') {
      this.updatePixelEyes();
      return;
    }

    const leftData = this.currentEmotion.leftEye;
    const rightData = this.currentEmotion.rightEye;

    // Apply look offset
    const leftCx = leftData.cx * 100 + this.lookOffset.x;
    const leftCy = leftData.cy * 100 + this.lookOffset.y;
    const rightCx = rightData.cx * 100 + this.lookOffset.x;
    const rightCy = rightData.cy * 100 + this.lookOffset.y;

    this.leftEyeEl.setAttribute('cx', String(leftCx));
    this.leftEyeEl.setAttribute('cy', String(leftCy));
    this.rightEyeEl.setAttribute('cx', String(rightCx));
    this.rightEyeEl.setAttribute('cy', String(rightCy));

    // Apply blink
    if (this.isBlinking) {
      const blinkScale = 1 - this.blinkState;
      this.leftEyeEl.setAttribute('ry', String(leftData.ry * 100 * blinkScale));
      this.rightEyeEl.setAttribute('ry', String(rightData.ry * 100 * blinkScale));
    } else {
      this.leftEyeEl.setAttribute('ry', String(leftData.ry * 100));
      this.rightEyeEl.setAttribute('ry', String(rightData.ry * 100));
    }
  }

  private updatePixelEyes(): void {
    // The geometry is stashed on the element at creation time, so it survives
    // the look offset being reapplied every frame.
    const readGeometry = (eye: SVGElement, name: string): number =>
      parseFloat(eye.getAttribute(name) ?? '0');

    const updatePixelEye = (eye: SVGElement | null): void => {
      if (!eye) return;

      const baseCx = readGeometry(eye, 'data-cx');
      const baseCy = readGeometry(eye, 'data-cy');
      const w = readGeometry(eye, 'data-w');
      const h = readGeometry(eye, 'data-h');

      const cx = baseCx + this.lookOffset.x;
      const cy = baseCy + this.lookOffset.y;

      eye.setAttribute('x', String(cx - w / 2));
      eye.setAttribute('y', String(cy - h / 2));

      // Blink by reducing height
      if (this.isBlinking) {
        const blinkScale = Math.max(0.1, 1 - this.blinkState);
        const newH = h * blinkScale;
        eye.setAttribute('height', String(newH));
        eye.setAttribute('y', String(cy - newH / 2));
      } else {
        eye.setAttribute('height', String(h));
      }
    };

    updatePixelEye(this.leftEyeEl);
    updatePixelEye(this.rightEyeEl);
  }

  private scheduleBlink(): void {
    const [minInterval, maxInterval] = this.currentEmotion.blinkInterval;
    const interval = minInterval + this.random() * (maxInterval - minInterval);

    this.blinkTimeoutId = setTimeout(() => {
      this.blink_();
      this.scheduleBlink();
    }, interval);
  }

  private blink_(): void {
    this.isBlinking = true;
    this.blinkState = 0;

    const blinkDuration = 150;
    const startTime = performance.now();

    const animateBlink = (currentTime: number): void => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / blinkDuration, 1);

      // Ease in-out for natural blink
      if (progress < 0.5) {
        this.blinkState = progress * 2;
      } else {
        this.blinkState = 1 - (progress - 0.5) * 2;
      }

      if (progress < 1) {
        requestAnimationFrame(animateBlink);
      } else {
        this.isBlinking = false;
        this.blinkState = 0;
      }
    };

    requestAnimationFrame(animateBlink);
  }

  // Public API

  /**
   * Set the emotion
   * @param {string} emotion - Emotion name
   */
  setEmotion(emotion: EmotionName): void {
    if (emotions[emotion]) {
      this.currentEmotion = emotions[emotion];
      this.options.emotion = emotion;
      this.rebuildEyes();
    }
  }

  /**
   * Get available emotions, in registry order.
   * @returns {string[]}
   */
  static getEmotions(): EmotionName[] {
    return [...EMOTIONS];
  }

  /**
   * Set a random emotion
   */
  randomEmotion(): void {
    const randomIndex = Math.floor(this.random() * EMOTIONS.length);
    this.setEmotion(EMOTIONS[randomIndex]!);
  }

  private rebuildEyes(): void {
    const eyeGroup = this.element.querySelector('.monako-eyes')!;
    eyeGroup.innerHTML = '';

    const ns = 'http://www.w3.org/2000/svg';
    this.leftEyeEl = this.createEye(ns, 'left');
    this.rightEyeEl = this.createEye(ns, 'right');

    eyeGroup.appendChild(this.leftEyeEl);
    eyeGroup.appendChild(this.rightEyeEl);
  }

  /**
   * Make the face look at a specific point
   * @param {number} x - X coordinate (0-1, 0.5 = center)
   * @param {number} y - Y coordinate (0-1, 0.5 = center)
   */
  lookAt(x: number, y: number): void {
    const range = this.currentEmotion.lookRange;
    this.targetLook.x = (x - 0.5) * range * 100 * 2;
    this.targetLook.y = (y - 0.5) * range * 100 * 2;
  }

  /**
   * Trigger a blink
   */
  blink(): void {
    this.blink_();
  }

  /**
   * Set face color
   * @param {string} color - CSS color
   */
  setColor(color: string): void {
    this.options.color = color;
    const face = this.element.querySelector('.monako-face');
    if (face) face.setAttribute('fill', String(color));
  }

  /**
   * Set face shape
   * @param {'circle' | 'square' | 'rounded'} shape - Shape type
   */
  setShape(shape: ShapeName): void {
    if (this.options.shape === shape) return;
    this.options.shape = shape;
    this.rebuildFace();
  }

  /**
   * Get available shapes, in registry order.
   * @returns {string[]}
   */
  static getShapes(): ShapeName[] {
    return [...SHAPES];
  }

  /**
   * Set eye style
   * @param {'smooth' | 'pixel'} style - Eye style
   */
  setEyeStyle(style: EyeStyleName): void {
    if (this.options.eyeStyle === style) return;
    this.options.eyeStyle = style;
    // Update shape-rendering on svg
    if (style === 'pixel') {
      this.element.setAttribute('shape-rendering', 'crispEdges');
    } else {
      this.element.removeAttribute('shape-rendering');
    }
    this.rebuildEyes();
  }

  /**
   * Get available eye styles, in registry order.
   * @returns {string[]}
   */
  static getEyeStyles(): EyeStyleName[] {
    return [...EYE_STYLES];
  }

  private rebuildFace(): void {
    const oldFace = this.element.querySelector('.monako-face');
    if (oldFace) {
      const ns = 'http://www.w3.org/2000/svg';
      const newFace = this.createFaceShape(ns);
      newFace.setAttribute('fill', String(this.options.color));
      newFace.setAttribute('class', 'monako-face');
      oldFace.replaceWith(newFace);
    }
  }

  /**
   * Set eye color
   * @param {string} color - CSS color
   */
  setEyeColor(color: string): void {
    this.options.eyeColor = color;
    if (this.leftEyeEl) this.leftEyeEl.setAttribute('fill', String(color));
    if (this.rightEyeEl) this.rightEyeEl.setAttribute('fill', String(color));
  }

  /**
   * Set size
   * @param {number} size - Size in pixels
   */
  setSize(size: number): void {
    this.options.size = size;
    this.element.setAttribute('width', String(size));
    this.element.setAttribute('height', String(size));
  }

  // ---------------------------------------------------------------------
  // Identity
  //
  // Everything a face *is*, as opposed to how it currently behaves. These are
  // what you persist: one short string per face, or nothing at all if you are
  // happy deriving it from an id you already store.
  // ---------------------------------------------------------------------

  /**
   * Derive the traits for a seed, without constructing anything.
   *
   * Useful when you want the numbers but not the DOM — server-side rendering,
   * tests, or picking a colour to match elsewhere in the UI.
   *
   * @param {string | number} seed
   * @param {Partial<import('./types.js').Traits>} [overrides]
   * @returns {import('./types.js').Traits}
   */
  static fromSeed(seed: string | number, overrides?: Partial<Traits>): Traits {
    return traitsFromSeed(seed, overrides);
  }

  /**
   * Decode a token into traits.
   *
   * @param {string} token
   * @returns {import('./types.js').Traits}
   * @throws {TypeError} if the string is not a token at all
   */
  static fromToken(token: string): Traits {
    return traitsFromToken(token);
  }

  /**
   * Encode traits (optionally including a `seed`) into a token.
   *
   * @param {Partial<import('./types.js').Traits> & { seed?: string | number | null }} traits
   * @returns {string}
   */
  static toToken(traits: Partial<Traits> & { seed?: string | number | null }): string {
    return toToken(traits);
  }

  /**
   * Whether a string decodes as a token. Guard values coming out of storage
   * with this rather than try/catch at every call site.
   *
   * @param {unknown} token
   * @returns {boolean}
   */
  static isValidToken(token: unknown): boolean {
    return isValidToken(token);
  }

  /**
   * This face's current traits, reflecting any setter calls since construction.
   *
   * @returns {import('./types.js').Traits}
   */
  getTraits(): Traits {
    return {
      color: this.options.color,
      eyeColor: this.options.eyeColor,
      emotion: this.options.emotion,
      shape: this.options.shape,
      eyeStyle: this.options.eyeStyle,
      ...(this.options.seed !== null ? { seed: String(this.options.seed) } : {}),
    };
  }

  /**
   * This face as a token — the string to put in a database column.
   *
   * Round-trips: `new Monako({ token: face.toToken() })` looks identical.
   *
   * @returns {string}
   */
  toToken(): string {
    return toToken(this.getTraits());
  }

  /**
   * Get the SVG element
   * @returns {SVGElement}
   */
  getElement(): SVGSVGElement {
    return this.element;
  }

  /**
   * Export as SVG string
   * @returns {string}
   */
  toSVG(): string {
    return this.element.outerHTML;
  }

  /**
   * Export as data URL
   * @returns {string}
   */
  toDataURL(): string {
    const svgString = this.toSVG();
    const encoded = encodeURIComponent(svgString);
    return `data:image/svg+xml,${encoded}`;
  }

  /**
   * Destroy the instance and cleanup
   */
  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.blinkTimeoutId) {
      clearTimeout(this.blinkTimeoutId);
    }
    if (this.cleanupCursor) {
      this.cleanupCursor();
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
