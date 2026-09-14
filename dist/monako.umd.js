/*!
 * Monako v0.1.0
 * Lightweight animated faces with expressive eyes
 * https://github.com/your-username/monako
 * MIT License
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Monako = {}));
})(this, (function (exports) { 'use strict';

  /**
   * Emotion definitions for Monako faces
   * Each emotion defines eye shape, position, and animation parameters
   */

  /** @typedef {'neutral'|'happy'|'sad'|'surprised'|'angry'|'sleepy'|'curious'|'love'} EmotionName */

  const emotions = {
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

  const defaultEmotion = 'neutral';

  /**
   * Monako - Animated face with expressive eyes
   */
  class Monako {
    constructor(options = {}) {
      this.options = {
        size: options.size || 100,
        color: options.color || '#000000',
        eyeColor: options.eyeColor || '#ffffff',
        emotion: options.emotion || defaultEmotion,
        shape: options.shape || 'circle', // 'circle' | 'square' | 'rounded'
        eyeStyle: options.eyeStyle || 'smooth', // 'smooth' | 'pixel'
        followCursor: options.followCursor ?? true,
        autoAnimate: options.autoAnimate ?? true,
        container: options.container || null,
        seed: options.seed || null,
      };

      this.currentEmotion = emotions[this.options.emotion] || emotions.neutral;
      this.lookOffset = { x: 0, y: 0 };
      this.targetLook = { x: 0, y: 0 };
      this.blinkState = 0;
      this.isBlinking = false;
      this.animationId = null;
      this.blinkTimeoutId = null;
      this.element = null;
      this.leftEyeEl = null;
      this.rightEyeEl = null;
      this.random = this._createRandom(this.options.seed);

      this._init();
    }

    _createFaceShape(ns) {
      const shape = this.options.shape;

      if (shape === 'circle') {
        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', '50');
        circle.setAttribute('cy', '50');
        circle.setAttribute('r', '48');
        return circle;
      }

      if (shape === 'square') {
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', '2');
        rect.setAttribute('y', '2');
        rect.setAttribute('width', '96');
        rect.setAttribute('height', '96');
        return rect;
      }

      // 'rounded' (default fallback)
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '2');
      rect.setAttribute('width', '96');
      rect.setAttribute('height', '96');
      rect.setAttribute('rx', '20');
      rect.setAttribute('ry', '20');
      return rect;
    }

    _createRandom(seed) {
      if (seed === null) {
        return Math.random;
      }
      // Simple seeded random for reproducible faces
      let s = seed;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    }

    _init() {
      this.element = this._createSVG();

      if (this.options.container) {
        const container = typeof this.options.container === 'string'
          ? document.querySelector(this.options.container)
          : this.options.container;

        if (container) {
          container.appendChild(this.element);
        }
      }

      if (this.options.followCursor) {
        this._setupCursorTracking();
      }

      if (this.options.autoAnimate) {
        this._startAnimation();
        this._scheduleBlink();
      }
    }

    _createSVG() {
      const size = this.options.size;
      const ns = 'http://www.w3.org/2000/svg';

      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      svg.setAttribute('viewBox', '0 0 100 100');
      if (this.options.eyeStyle === 'pixel') {
        svg.setAttribute('shape-rendering', 'crispEdges');
      }
      svg.style.display = 'block';

      // Face shape
      const face = this._createFaceShape(ns);
      face.setAttribute('fill', this.options.color);
      face.setAttribute('class', 'monako-face');
      svg.appendChild(face);

      // Eye container group
      const eyeGroup = document.createElementNS(ns, 'g');
      eyeGroup.setAttribute('class', 'monako-eyes');

      // Left eye
      this.leftEyeEl = this._createEye(ns, 'left');
      eyeGroup.appendChild(this.leftEyeEl);

      // Right eye
      this.rightEyeEl = this._createEye(ns, 'right');
      eyeGroup.appendChild(this.rightEyeEl);

      svg.appendChild(eyeGroup);

      return svg;
    }

    _createEye(ns, side) {
      const eyeData = side === 'left'
        ? this.currentEmotion.leftEye
        : this.currentEmotion.rightEye;

      if (this.options.eyeStyle === 'pixel') {
        return this._createPixelEye(ns, side, eyeData);
      }

      const eye = document.createElementNS(ns, 'ellipse');
      eye.setAttribute('cx', eyeData.cx * 100);
      eye.setAttribute('cy', eyeData.cy * 100);
      eye.setAttribute('rx', eyeData.rx * 100);
      eye.setAttribute('ry', eyeData.ry * 100);
      eye.setAttribute('fill', this.options.eyeColor);
      eye.style.transition = 'rx 0.1s ease, ry 0.1s ease';

      // Apply emotion-specific transforms
      if (this.currentEmotion.tiltAngle) {
        const tilt = side === 'left'
          ? -this.currentEmotion.tiltAngle
          : this.currentEmotion.tiltAngle;
        eye.setAttribute('transform', `rotate(${tilt} ${eyeData.cx * 100} ${eyeData.cy * 100})`);
      }

      if (this.currentEmotion.droopAngle) {
        const droop = side === 'left'
          ? this.currentEmotion.droopAngle
          : -this.currentEmotion.droopAngle;
        eye.setAttribute('transform', `rotate(${droop} ${eyeData.cx * 100} ${eyeData.cy * 100})`);
      }

      return eye;
    }

    _createPixelEye(ns, side, eyeData) {
      // Pixel eyes: simple rectangles
      const eye = document.createElementNS(ns, 'rect');
      const w = eyeData.rx * 100 * 1.4; // width
      const h = eyeData.ry * 100 * 1.6; // height
      const cx = eyeData.cx * 100;
      const cy = eyeData.cy * 100;

      eye.setAttribute('x', cx - w / 2);
      eye.setAttribute('y', cy - h / 2);
      eye.setAttribute('width', w);
      eye.setAttribute('height', h);
      eye.setAttribute('fill', this.options.eyeColor);
      eye.setAttribute('data-cx', cx);
      eye.setAttribute('data-cy', cy);
      eye.setAttribute('data-w', w);
      eye.setAttribute('data-h', h);

      return eye;
    }

    _setupCursorTracking() {
      const onMouseMove = (e) => {
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
      this._cleanupCursor = () => document.removeEventListener('mousemove', onMouseMove);
    }

    _startAnimation() {
      const animate = () => {
        // Smooth eye movement
        this.lookOffset.x += (this.targetLook.x - this.lookOffset.x) * 0.1;
        this.lookOffset.y += (this.targetLook.y - this.lookOffset.y) * 0.1;

        this._updateEyes();
        this.animationId = requestAnimationFrame(animate);
      };

      animate();
    }

    _updateEyes() {
      if (!this.leftEyeEl || !this.rightEyeEl) return;

      if (this.options.eyeStyle === 'pixel') {
        this._updatePixelEyes();
        return;
      }

      const leftData = this.currentEmotion.leftEye;
      const rightData = this.currentEmotion.rightEye;

      // Apply look offset
      const leftCx = leftData.cx * 100 + this.lookOffset.x;
      const leftCy = leftData.cy * 100 + this.lookOffset.y;
      const rightCx = rightData.cx * 100 + this.lookOffset.x;
      const rightCy = rightData.cy * 100 + this.lookOffset.y;

      this.leftEyeEl.setAttribute('cx', leftCx);
      this.leftEyeEl.setAttribute('cy', leftCy);
      this.rightEyeEl.setAttribute('cx', rightCx);
      this.rightEyeEl.setAttribute('cy', rightCy);

      // Apply blink
      if (this.isBlinking) {
        const blinkScale = 1 - this.blinkState;
        this.leftEyeEl.setAttribute('ry', leftData.ry * 100 * blinkScale);
        this.rightEyeEl.setAttribute('ry', rightData.ry * 100 * blinkScale);
      } else {
        this.leftEyeEl.setAttribute('ry', leftData.ry * 100);
        this.rightEyeEl.setAttribute('ry', rightData.ry * 100);
      }
    }

    _updatePixelEyes() {
      const updatePixelEye = (eye) => {
        const baseCx = parseFloat(eye.getAttribute('data-cx'));
        const baseCy = parseFloat(eye.getAttribute('data-cy'));
        const w = parseFloat(eye.getAttribute('data-w'));
        const h = parseFloat(eye.getAttribute('data-h'));

        const cx = baseCx + this.lookOffset.x;
        const cy = baseCy + this.lookOffset.y;

        eye.setAttribute('x', cx - w / 2);
        eye.setAttribute('y', cy - h / 2);

        // Blink by reducing height
        if (this.isBlinking) {
          const blinkScale = Math.max(0.1, 1 - this.blinkState);
          const newH = h * blinkScale;
          eye.setAttribute('height', newH);
          eye.setAttribute('y', cy - newH / 2);
        } else {
          eye.setAttribute('height', h);
        }
      };

      updatePixelEye(this.leftEyeEl);
      updatePixelEye(this.rightEyeEl);
    }

    _scheduleBlink() {
      const [minInterval, maxInterval] = this.currentEmotion.blinkInterval;
      const interval = minInterval + this.random() * (maxInterval - minInterval);

      this.blinkTimeoutId = setTimeout(() => {
        this._blink();
        this._scheduleBlink();
      }, interval);
    }

    _blink() {
      this.isBlinking = true;
      this.blinkState = 0;

      const blinkDuration = 150;
      const startTime = performance.now();

      const animateBlink = (currentTime) => {
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
    setEmotion(emotion) {
      if (emotions[emotion]) {
        this.currentEmotion = emotions[emotion];
        this.options.emotion = emotion;
        this._rebuildEyes();
      }
    }

    /**
     * Get available emotions
     * @returns {string[]}
     */
    static getEmotions() {
      return Object.keys(emotions);
    }

    /**
     * Set a random emotion
     */
    randomEmotion() {
      const emotionList = Object.keys(emotions);
      const randomIndex = Math.floor(this.random() * emotionList.length);
      this.setEmotion(emotionList[randomIndex]);
    }

    _rebuildEyes() {
      const eyeGroup = this.element.querySelector('.monako-eyes');
      eyeGroup.innerHTML = '';

      const ns = 'http://www.w3.org/2000/svg';
      this.leftEyeEl = this._createEye(ns, 'left');
      this.rightEyeEl = this._createEye(ns, 'right');

      eyeGroup.appendChild(this.leftEyeEl);
      eyeGroup.appendChild(this.rightEyeEl);
    }

    /**
     * Make the face look at a specific point
     * @param {number} x - X coordinate (0-1, 0.5 = center)
     * @param {number} y - Y coordinate (0-1, 0.5 = center)
     */
    lookAt(x, y) {
      const range = this.currentEmotion.lookRange;
      this.targetLook.x = (x - 0.5) * range * 100 * 2;
      this.targetLook.y = (y - 0.5) * range * 100 * 2;
    }

    /**
     * Trigger a blink
     */
    blink() {
      this._blink();
    }

    /**
     * Set face color
     * @param {string} color - CSS color
     */
    setColor(color) {
      this.options.color = color;
      const face = this.element.querySelector('.monako-face');
      if (face) face.setAttribute('fill', color);
    }

    /**
     * Set face shape
     * @param {'circle' | 'square' | 'rounded'} shape - Shape type
     */
    setShape(shape) {
      if (this.options.shape === shape) return;
      this.options.shape = shape;
      this._rebuildFace();
    }

    /**
     * Get available shapes
     * @returns {string[]}
     */
    static getShapes() {
      return ['circle', 'square', 'rounded'];
    }

    /**
     * Set eye style
     * @param {'smooth' | 'pixel'} style - Eye style
     */
    setEyeStyle(style) {
      if (this.options.eyeStyle === style) return;
      this.options.eyeStyle = style;
      // Update shape-rendering on svg
      if (style === 'pixel') {
        this.element.setAttribute('shape-rendering', 'crispEdges');
      } else {
        this.element.removeAttribute('shape-rendering');
      }
      this._rebuildEyes();
    }

    /**
     * Get available eye styles
     * @returns {string[]}
     */
    static getEyeStyles() {
      return ['smooth', 'pixel'];
    }

    _rebuildFace() {
      const oldFace = this.element.querySelector('.monako-face');
      if (oldFace) {
        const ns = 'http://www.w3.org/2000/svg';
        const newFace = this._createFaceShape(ns);
        newFace.setAttribute('fill', this.options.color);
        newFace.setAttribute('class', 'monako-face');
        oldFace.replaceWith(newFace);
      }
    }

    /**
     * Set eye color
     * @param {string} color - CSS color
     */
    setEyeColor(color) {
      this.options.eyeColor = color;
      if (this.leftEyeEl) this.leftEyeEl.setAttribute('fill', color);
      if (this.rightEyeEl) this.rightEyeEl.setAttribute('fill', color);
    }

    /**
     * Set size
     * @param {number} size - Size in pixels
     */
    setSize(size) {
      this.options.size = size;
      this.element.setAttribute('width', size);
      this.element.setAttribute('height', size);
    }

    /**
     * Get the SVG element
     * @returns {SVGElement}
     */
    getElement() {
      return this.element;
    }

    /**
     * Export as SVG string
     * @returns {string}
     */
    toSVG() {
      return this.element.outerHTML;
    }

    /**
     * Export as data URL
     * @returns {string}
     */
    toDataURL() {
      const svgString = this.toSVG();
      const encoded = encodeURIComponent(svgString);
      return `data:image/svg+xml,${encoded}`;
    }

    /**
     * Destroy the instance and cleanup
     */
    destroy() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      if (this.blinkTimeoutId) {
        clearTimeout(this.blinkTimeoutId);
      }
      if (this._cleanupCursor) {
        this._cleanupCursor();
      }
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }

  /**
   * Create a Monako face
   * @param {Object} options - Configuration options
   * @returns {Monako}
   */
  function createMonako(options) {
    return new Monako(options);
  }

  /**
   * Create multiple random Monako faces
   * @param {number} count - Number of faces to create
   * @param {Object} baseOptions - Base options for all faces
   * @returns {Monako[]}
   */
  function createMany(count, baseOptions = {}) {
    const faces = [];
    for (let i = 0; i < count; i++) {
      faces.push(new Monako({
        ...baseOptions,
        seed: baseOptions.seed ? baseOptions.seed + i : null,
      }));
    }
    return faces;
  }

  exports.Monako = Monako;
  exports.createMany = createMany;
  exports.createMonako = createMonako;
  exports.default = Monako;
  exports.emotions = emotions;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
