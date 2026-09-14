import { emotions, defaultEmotion } from './emotions.js';

/**
 * Monako - Animated face with expressive eyes
 */
export class Monako {
  constructor(options = {}) {
    this.options = {
      size: options.size || 100,
      color: options.color || '#000000',
      eyeColor: options.eyeColor || '#ffffff',
      emotion: options.emotion || defaultEmotion,
      shape: options.shape || 'circle', // 'circle' | 'square' | 'rounded'
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

  _setupCursorTracking() {
    const onMouseMove = (e) => {
      if (!this.element) return;

      const rect = this.element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxDistance = Math.max(window.innerWidth, window.innerHeight);
      const normalizedDistance = Math.min(distance / maxDistance, 1);

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
