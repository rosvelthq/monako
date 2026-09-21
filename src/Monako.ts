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
  animated: boolean;
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
  private lastCursorMove: number = 0;
  private wanderTarget: Point = { x: 0, y: 0 };
  private wanderTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentMood: 'normal' | 'happy' | 'sad' | 'serious' | 'closed' = 'normal';
  private moodTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private moodTransition: number = 0;

  private orbGL: {
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    timeLocation: WebGLUniformLocation;
    activityLocation: WebGLUniformLocation;
    baseColorLocation: WebGLUniformLocation;
  } | null = null;

  constructor(options: MonakoOptions = {}) {
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
      animated: options.animated ?? false,
      container: options.container ?? null,
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

    if (shape === 'rounded') {
      const rect = document.createElementNS(ns, 'rect') as SVGElement;
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '2');
      rect.setAttribute('width', '96');
      rect.setAttribute('height', '96');
      rect.setAttribute('rx', '20');
      rect.setAttribute('ry', '20');
      return rect;
    }

    if (shape === 'blob') {
      const path = document.createElementNS(ns, 'path') as SVGElement;
      path.setAttribute('d',
        'M50 4 ' +
        'C75 4 92 15 95 35 ' +
        'C98 55 90 75 80 85 ' +
        'C65 98 35 98 20 85 ' +
        'C5 72 2 50 8 30 ' +
        'C14 12 30 4 50 4 Z'
      );
      return path;
    }

    if (shape === 'drop') {
      const path = document.createElementNS(ns, 'path') as SVGElement;
      path.setAttribute('d',
        'M50 5 ' +
        'C60 5 75 20 85 40 ' +
        'C95 60 95 80 80 90 ' +
        'C65 100 35 100 20 90 ' +
        'C5 80 5 60 15 40 ' +
        'C25 20 40 5 50 5 Z'
      );
      return path;
    }

    if (shape === 'pill') {
      const rect = document.createElementNS(ns, 'rect') as SVGElement;
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '20');
      rect.setAttribute('width', '96');
      rect.setAttribute('height', '60');
      rect.setAttribute('rx', '30');
      rect.setAttribute('ry', '30');
      return rect;
    }

    // Fallback to circle
    const circle = document.createElementNS(ns, 'circle') as SVGElement;
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '50');
    circle.setAttribute('r', '48');
    return circle;
  }

  private createRandom(seed: string | number | null): () => number {
    if (seed === null || seed === undefined) {
      return Math.random;
    }

    let s = typeof seed === 'number' ? seed >>> 0 : fnv1a(String(seed));
    if (s === 0) s = 0x9e3779b9;

    return () => {
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

    // Animated WebGL background or solid color
    if (this.options.animated) {
      const animBg = this.createAnimatedBackground(ns);
      if (animBg) svg.appendChild(animBg);
    } else {
      const face = this.createFaceShape(ns);
      face.setAttribute('fill', String(this.options.color));
      face.setAttribute('class', 'monako-face');
      svg.appendChild(face);
    }

    // Eye container group (skip for 'none' style)
    if (this.options.eyeStyle !== 'none') {
      const eyeGroup = document.createElementNS(ns, 'g') as SVGElement;
      eyeGroup.setAttribute('class', 'monako-eyes');

      this.leftEyeEl = this.createEye(ns, 'left');
      eyeGroup.appendChild(this.leftEyeEl);

      this.rightEyeEl = this.createEye(ns, 'right');
      eyeGroup.appendChild(this.rightEyeEl);

      svg.appendChild(eyeGroup);
    }

    return svg;
  }

  private createAnimatedBackground(ns: string): SVGElement | null {
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        const group = document.createElementNS(ns, 'g') as SVGElement;
        const clipId = `monako-clip-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        // Create clipPath with the actual shape
        const defs = document.createElementNS(ns, 'defs');
        const clipPath = document.createElementNS(ns, 'clipPath');
        clipPath.setAttribute('id', clipId);
        const clipShape = this.createFaceShape(ns);
        clipPath.appendChild(clipShape);
        defs.appendChild(clipPath);
        group.appendChild(defs);

        // Create foreignObject with canvas, clipped to shape
        const fo = document.createElementNS(ns, 'foreignObject') as SVGElement;
        fo.setAttribute('x', '0');
        fo.setAttribute('y', '0');
        fo.setAttribute('width', '100');
        fo.setAttribute('height', '100');
        fo.setAttribute('clip-path', `url(#${clipId})`);
        fo.setAttribute('class', 'monako-face');

        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        canvas.style.width = '100px';
        canvas.style.height = '100px';
        canvas.className = 'orb-canvas';

        fo.appendChild(canvas);
        group.appendChild(fo);

        if (this.initOrbWebGL(canvas)) {
          return group;
        }
      }
    } catch {
      // Fall through to SVG fallback
    }

    return this.createAnimatedFallback(ns);
  }

  private createAnimatedFallback(ns: string): SVGElement {
    const group = document.createElementNS(ns, 'g') as SVGElement;
    const uid = Date.now();

    const defs = document.createElementNS(ns, 'defs');

    const gradientId = `animated-fallback-${uid}`;
    const gradient = document.createElementNS(ns, 'radialGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('cx', '40%');
    gradient.setAttribute('cy', '35%');
    gradient.setAttribute('r', '60%');

    const rgb = this.hexToRgb(this.options.color);
    const lighten = (c: number, amt: number) => Math.min(1, c + amt);
    const darken = (c: number, amt: number) => Math.max(0, c - amt);

    const toHex = (r: number, g: number, b: number) =>
      '#' + [r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');

    const stops = [
      { offset: '0%', color: toHex(lighten(rgb[0], 0.4), lighten(rgb[1], 0.4), lighten(rgb[2], 0.4)) },
      { offset: '40%', color: toHex(lighten(rgb[0], 0.2), lighten(rgb[1], 0.2), lighten(rgb[2], 0.2)) },
      { offset: '70%', color: this.options.color },
      { offset: '100%', color: toHex(darken(rgb[0], 0.15), darken(rgb[1], 0.15), darken(rgb[2], 0.15)) },
    ];
    for (const s of stops) {
      const stop = document.createElementNS(ns, 'stop');
      stop.setAttribute('offset', s.offset);
      stop.setAttribute('stop-color', s.color);
      gradient.appendChild(stop);
    }
    defs.appendChild(gradient);
    group.appendChild(defs);

    const face = this.createFaceShape(ns);
    face.setAttribute('fill', `url(#${gradientId})`);
    face.setAttribute('class', 'monako-face');
    group.appendChild(face);

    return group;
  }

  private initOrbWebGL(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) return false;

    const vertSrc = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragSrc = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_activity;
      uniform vec3 u_baseColor;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
        for (int octave = 0; octave < 5; octave++) {
          value += amplitude * noise(p);
          p = rotation * p * 1.92 + vec2(9.7, 4.3);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 centered = uv - 0.5;
        vec2 p = centered * 2.0;
        float t = u_time;

        vec2 warp = vec2(
          fbm(p * 1.02 + vec2(t * 0.34, -t * 0.24)),
          fbm(p * 1.08 + vec2(-t * 0.27, t * 0.32) + vec2(6.7, 2.9))
        );
        vec2 curl = vec2(
          sin(p.y * 2.4 + t * 0.68 + warp.y * 3.2),
          cos(p.x * 2.1 - t * 0.61 + warp.x * 3.0)
        );
        vec2 warped = p + (warp - 0.5) * (1.18 + u_activity * 0.38) + curl * (0.035 + u_activity * 0.07);
        float broad = fbm(warped * 0.92 + vec2(t * 0.14, -t * 0.18));
        float folded = fbm(warped * 1.66 + vec2(-t * 0.23, t * 0.19) + 5.2);
        float field = mix(broad, folded, 0.3 + u_activity * 0.14);

        float horizon = 0.46 + 0.08 * sin((uv.x + warp.x * 0.2) * 5.4 + t * 0.42) + 0.16 * (broad - 0.5);
        float upper = smoothstep(horizon - 0.12, horizon + 0.08, uv.y);
        float band = exp(-pow((uv.y - horizon) * (5.2 + u_activity * 0.8), 2.0));
        float cloud = smoothstep(0.24, 0.79, field);

        vec3 deep = u_baseColor * 0.7;
        vec3 mid = u_baseColor;
        vec3 light = mix(u_baseColor, vec3(1.0), 0.4);
        vec3 milk = mix(u_baseColor, vec3(1.0), 0.75);

        vec3 color = mix(light, mid, upper);
        float upperDepth = upper * (0.14 + smoothstep(0.42, 0.78, folded) * 0.5);
        color = mix(color, deep, upperDepth);

        float milkAmount = clamp(band * (0.42 + cloud * 0.62), 0.0, 0.88);
        color = mix(color, milk, milkAmount);

        float lowerMist = (1.0 - upper) * smoothstep(0.58, 0.9, broad) * 0.18;
        color = mix(color, milk, lowerMist);

        float grain = (noise(gl_FragCoord.xy * 0.64) - 0.5) / 255.0;
        color += grain;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const compileShader = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertShader = compileShader(gl.VERTEX_SHADER, vertSrc);
    const fragShader = compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vertShader || !fragShader) return false;

    const program = gl.createProgram();
    if (!program) return false;

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return false;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    gl.uniform2f(resLoc, canvas.width, canvas.height);

    const baseColorLoc = gl.getUniformLocation(program, 'u_baseColor');
    const rgb = this.hexToRgb(this.options.color);
    gl.uniform3f(baseColorLoc, rgb[0], rgb[1], rgb[2]);

    this.orbGL = {
      gl,
      program,
      timeLocation: gl.getUniformLocation(program, 'u_time')!,
      activityLocation: gl.getUniformLocation(program, 'u_activity')!,
      baseColorLocation: baseColorLoc!,
    };

    return true;
  }

  private hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }

  private createEye(ns: string, side: 'left' | 'right'): SVGElement {
    const eyeData = side === 'left'
      ? this.currentEmotion.leftEye
      : this.currentEmotion.rightEye;

    if (this.options.eyeStyle === 'pixel') {
      return this.createPixelEye(ns, eyeData);
    }

    if (this.options.eyeStyle === 'pill') {
      return this.createPillEye(ns, eyeData, side);
    }

    // Smooth eyes (default)
    const eye = document.createElementNS(ns, 'ellipse') as SVGElement;
    const smoothScale = 0.8;
    eye.setAttribute('cx', String(eyeData.cx * 100));
    eye.setAttribute('cy', String(eyeData.cy * 100));
    eye.setAttribute('rx', String(eyeData.rx * 100 * smoothScale));
    eye.setAttribute('ry', String(eyeData.ry * 100 * smoothScale));
    eye.setAttribute('fill', String(this.options.eyeColor));
    eye.style.transition = 'rx 0.1s ease, ry 0.1s ease';

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
    const eye = document.createElementNS(ns, 'rect') as SVGElement;
    const pixelScale = 0.8;
    const w = eyeData.rx * 100 * 1.4 * pixelScale;
    const h = eyeData.ry * 100 * 1.6 * pixelScale;
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

  private createPillEye(ns: string, eyeData: EyeGeometry, side: 'left' | 'right'): SVGElement {
    const eye = document.createElementNS(ns, 'rect') as SVGElement;
    const w = eyeData.rx * 100 * 0.85;
    const h = eyeData.ry * 100 * 1.1;
    const offsetX = side === 'left' ? 3 : -3;
    const cx = eyeData.cx * 100 + offsetX;
    const cy = eyeData.cy * 100;
    const radius = Math.min(w, h) / 2;

    eye.setAttribute('x', String(cx - w / 2));
    eye.setAttribute('y', String(cy - h / 2));
    eye.setAttribute('width', String(w));
    eye.setAttribute('height', String(h));
    eye.setAttribute('rx', String(radius));
    eye.setAttribute('ry', String(radius));
    eye.setAttribute('fill', String(this.options.eyeColor));
    eye.setAttribute('data-cx', String(cx));
    eye.setAttribute('data-cy', String(cy));
    eye.setAttribute('data-w', String(w));
    eye.setAttribute('data-h', String(h));
    eye.setAttribute('data-rotation', '0');
    eye.setAttribute('data-side', side);

    return eye;
  }

  private setupCursorTracking(): void {
    const onMouseMove = (e: MouseEvent): void => {
      if (!this.element) return;

      this.lastCursorMove = performance.now();

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

    this.scheduleWander();

    if (this.options.eyeStyle === 'pill') {
      this.scheduleMoodChange();
    }
  }

  private scheduleWander(): void {
    const interval = 1500 + this.random() * 2500;

    this.wanderTimeoutId = setTimeout(() => {
      const range = this.currentEmotion.lookRange * 100;
      this.wanderTarget.x = (this.random() - 0.5) * range * 1.5;
      this.wanderTarget.y = (this.random() - 0.5) * range * 1.2;
      this.scheduleWander();
    }, interval);
  }

  private scheduleMoodChange(): void {
    const interval = 3000 + this.random() * 5000;

    this.moodTimeoutId = setTimeout(() => {
      const roll = this.random();
      if (roll < 0.55) {
        this.currentMood = 'normal';
      } else if (roll < 0.70) {
        this.currentMood = 'happy';
      } else if (roll < 0.82) {
        this.currentMood = 'sad';
      } else if (roll < 0.92) {
        this.currentMood = 'serious';
      } else {
        this.currentMood = 'closed';
      }
      this.moodTransition = 0;
      this.scheduleMoodChange();
    }, interval);
  }

  private getMoodParams(side: 'left' | 'right'): { scaleY: number; rotation: number; offsetY: number } {
    this.moodTransition = Math.min(1, this.moodTransition + 0.05);
    const t = this.moodTransition;
    const s = side === 'left' ? 1 : -1;

    switch (this.currentMood) {
      case 'happy':
        return { scaleY: 1, rotation: -8 * t * s, offsetY: -2 * t };
      case 'sad':
        return { scaleY: 1, rotation: 10 * t * s, offsetY: 3 * t };
      case 'serious':
        return { scaleY: 0.65 + 0.35 * (1 - t), rotation: 0, offsetY: 0 };
      case 'closed':
        return { scaleY: 0.1 + 0.9 * (1 - t), rotation: 0, offsetY: 0 };
      default:
        return { scaleY: 1, rotation: 0, offsetY: 0 };
    }
  }

  private startAnimation(): void {
    const animate = () => {
      const now = performance.now();
      const idleTime = now - this.lastCursorMove;

      if (idleTime > 800 && this.options.followCursor) {
        const wanderLerp = Math.min(1, (idleTime - 800) / 500);
        const cursorInfluence = 1 - wanderLerp;
        this.targetLook.x = this.targetLook.x * cursorInfluence + this.wanderTarget.x * wanderLerp;
        this.targetLook.y = this.targetLook.y * cursorInfluence + this.wanderTarget.y * wanderLerp;
      }

      this.lookOffset.x += (this.targetLook.x - this.lookOffset.x) * 0.08;
      this.lookOffset.y += (this.targetLook.y - this.lookOffset.y) * 0.08;

      if (this.options.animated) {
        this.updateAnimatedBackground();
      }

      this.updateEyes();
      this.animationId = requestAnimationFrame(animate);
    };

    animate();
  }

  private updateAnimatedBackground(): void {
    if (!this.orbGL) return;

    const { gl, timeLocation, activityLocation } = this.orbGL;
    const time = performance.now() / 1000;
    const activity = this.isBlinking ? 0.3 + this.blinkState * 0.5 : 0.1;

    gl.uniform1f(timeLocation, time);
    gl.uniform1f(activityLocation, activity);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private updateEyes(): void {
    if (!this.leftEyeEl || !this.rightEyeEl) return;

    if (this.options.eyeStyle === 'pixel' || this.options.eyeStyle === 'pill') {
      this.updateRectEyes();
      return;
    }

    const leftData = this.currentEmotion.leftEye;
    const rightData = this.currentEmotion.rightEye;

    const leftCx = leftData.cx * 100 + this.lookOffset.x;
    const leftCy = leftData.cy * 100 + this.lookOffset.y;
    const rightCx = rightData.cx * 100 + this.lookOffset.x;
    const rightCy = rightData.cy * 100 + this.lookOffset.y;

    this.leftEyeEl.setAttribute('cx', String(leftCx));
    this.leftEyeEl.setAttribute('cy', String(leftCy));
    this.rightEyeEl.setAttribute('cx', String(rightCx));
    this.rightEyeEl.setAttribute('cy', String(rightCy));

    if (this.isBlinking) {
      const blinkScale = 1 - this.blinkState;
      this.leftEyeEl.setAttribute('ry', String(leftData.ry * 100 * blinkScale));
      this.rightEyeEl.setAttribute('ry', String(rightData.ry * 100 * blinkScale));
    } else {
      this.leftEyeEl.setAttribute('ry', String(leftData.ry * 100));
      this.rightEyeEl.setAttribute('ry', String(rightData.ry * 100));
    }
  }

  private updateRectEyes(): void {
    const readGeometry = (eye: SVGElement, name: string): number =>
      parseFloat(eye.getAttribute(name) ?? '0');

    const isPill = this.options.eyeStyle === 'pill';

    const updateRectEye = (eye: SVGElement | null, side: 'left' | 'right'): void => {
      if (!eye) return;

      const baseCx = readGeometry(eye, 'data-cx');
      const baseCy = readGeometry(eye, 'data-cy');
      const w = readGeometry(eye, 'data-w');
      const h = readGeometry(eye, 'data-h');

      const cx = baseCx + this.lookOffset.x;
      const cy = baseCy + this.lookOffset.y;

      if (isPill) {
        const baseRotation = readGeometry(eye, 'data-rotation');
        const mood = this.getMoodParams(side);

        const scaleY = (this.isBlinking && this.currentMood !== 'closed')
          ? Math.max(0.1, 1 - this.blinkState)
          : mood.scaleY;

        const rotation = baseRotation + mood.rotation;
        const offsetY = this.lookOffset.y + mood.offsetY;

        eye.setAttribute('transform',
          `translate(${this.lookOffset.x} ${offsetY}) ` +
          `rotate(${rotation} ${baseCx} ${baseCy}) ` +
          `translate(${baseCx} ${baseCy}) scale(1 ${scaleY}) translate(${-baseCx} ${-baseCy})`
        );
      } else {
        eye.setAttribute('x', String(cx - w / 2));
        eye.setAttribute('y', String(cy - h / 2));

        if (this.isBlinking) {
          const blinkScale = Math.max(0.1, 1 - this.blinkState);
          const newH = h * blinkScale;
          eye.setAttribute('height', String(newH));
          eye.setAttribute('y', String(cy - newH / 2));
        } else {
          eye.setAttribute('height', String(h));
        }
      }
    };

    updateRectEye(this.leftEyeEl, 'left');
    updateRectEye(this.rightEyeEl, 'right');
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

  setEmotion(emotion: EmotionName): void {
    if (emotions[emotion]) {
      this.currentEmotion = emotions[emotion];
      this.options.emotion = emotion;
      this.rebuildEyes();
    }
  }

  static getEmotions(): EmotionName[] {
    return [...EMOTIONS];
  }

  randomEmotion(): void {
    const randomIndex = Math.floor(this.random() * EMOTIONS.length);
    this.setEmotion(EMOTIONS[randomIndex]!);
  }

  private rebuildEyes(): void {
    const ns = 'http://www.w3.org/2000/svg';
    let eyeGroup = this.element.querySelector('.monako-eyes');

    if (this.options.eyeStyle === 'none') {
      if (eyeGroup) eyeGroup.remove();
      this.leftEyeEl = null;
      this.rightEyeEl = null;
      return;
    }

    if (!eyeGroup) {
      eyeGroup = document.createElementNS(ns, 'g') as SVGElement;
      eyeGroup.setAttribute('class', 'monako-eyes');
      this.element.appendChild(eyeGroup);
    } else {
      eyeGroup.innerHTML = '';
    }

    this.leftEyeEl = this.createEye(ns, 'left');
    this.rightEyeEl = this.createEye(ns, 'right');

    eyeGroup.appendChild(this.leftEyeEl);
    eyeGroup.appendChild(this.rightEyeEl);
  }

  lookAt(x: number, y: number): void {
    const range = this.currentEmotion.lookRange;
    this.targetLook.x = (x - 0.5) * range * 100 * 2;
    this.targetLook.y = (y - 0.5) * range * 100 * 2;
  }

  blink(): void {
    this.blink_();
  }

  setColor(color: string): void {
    this.options.color = color;
    const face = this.element.querySelector('.monako-face');
    if (face) face.setAttribute('fill', String(color));
  }

  setShape(shape: ShapeName): void {
    if (this.options.shape === shape) return;
    this.options.shape = shape;
    this.rebuildFace();
  }

  static getShapes(): ShapeName[] {
    return [...SHAPES];
  }

  setEyeStyle(style: EyeStyleName): void {
    if (this.options.eyeStyle === style) return;
    this.options.eyeStyle = style;
    if (style === 'pixel') {
      this.element.setAttribute('shape-rendering', 'crispEdges');
    } else {
      this.element.removeAttribute('shape-rendering');
    }
    this.rebuildEyes();
  }

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

  setEyeColor(color: string): void {
    this.options.eyeColor = color;
    if (this.leftEyeEl) this.leftEyeEl.setAttribute('fill', String(color));
    if (this.rightEyeEl) this.rightEyeEl.setAttribute('fill', String(color));
  }

  setSize(size: number): void {
    this.options.size = size;
    this.element.setAttribute('width', String(size));
    this.element.setAttribute('height', String(size));
  }

  static fromSeed(seed: string | number, overrides?: Partial<Traits>): Traits {
    return traitsFromSeed(seed, overrides);
  }

  static fromToken(token: string): Traits {
    return traitsFromToken(token);
  }

  static toToken(traits: Partial<Traits> & { seed?: string | number | null }): string {
    return toToken(traits);
  }

  static isValidToken(token: unknown): boolean {
    return isValidToken(token);
  }

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

  toToken(): string {
    return toToken(this.getTraits());
  }

  getElement(): SVGSVGElement {
    return this.element;
  }

  toSVG(): string {
    return this.element.outerHTML;
  }

  toDataURL(): string {
    const svgString = this.toSVG();
    const encoded = encodeURIComponent(svgString);
    return `data:image/svg+xml,${encoded}`;
  }

  destroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.blinkTimeoutId) clearTimeout(this.blinkTimeoutId);
    if (this.wanderTimeoutId) clearTimeout(this.wanderTimeoutId);
    if (this.moodTimeoutId) clearTimeout(this.moodTimeoutId);
    if (this.cleanupCursor) this.cleanupCursor();
    if (this.orbGL) {
      this.orbGL.gl.getExtension('WEBGL_lose_context')?.loseContext();
      this.orbGL = null;
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
