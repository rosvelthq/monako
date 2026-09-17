import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Monako,
  traitsFromSeed,
} from '../dist/monako.esm.js';

/**
 * A DOM just large enough to build a face in.
 *
 * Pulling in jsdom to assert that five setAttribute calls happened would cost
 * more than it is worth; constructing with `autoAnimate` and `followCursor`
 * off keeps us clear of rAF, timers and pointer events, which leaves a very
 * small surface to fake.
 */
function installFakeDom() {
  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.attributes = {};
      this.children = [];
      this.style = {};
      this.parentNode = null;
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
    getAttribute(name) {
      return this.attributes[name] ?? null;
    }
    removeAttribute(name) {
      delete this.attributes[name];
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    removeChild(child) {
      this.children = this.children.filter((c) => c !== child);
      child.parentNode = null;
      return child;
    }
    replaceWith(next) {
      if (!this.parentNode) return;
      const index = this.parentNode.children.indexOf(this);
      if (index !== -1) {
        next.parentNode = this.parentNode;
        this.parentNode.children[index] = next;
      }
    }
    set innerHTML(_value) {
      this.children = [];
    }
    get innerHTML() {
      return '';
    }
    /** Supports only the `.class` selectors Monako actually uses. */
    querySelector(selector) {
      const wanted = selector.replace(/^\./, '');
      const walk = (node) => {
        for (const child of node.children) {
          if ((child.attributes.class ?? '') === wanted) return child;
          const found = walk(child);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    }
    descendants() {
      return this.children.flatMap((c) => [c, ...c.descendants()]);
    }
  }

  const previous = {
    document: globalThis.document,
    window: globalThis.window,
  };

  globalThis.document = {
    createElementNS: (_ns, tagName) => new FakeElement(tagName),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.window = { innerWidth: 1000, innerHeight: 800 };

  return () => {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
  };
}

const QUIET = { followCursor: false, autoAnimate: false };

function build(options) {
  return new Monako({ ...QUIET, ...options });
}

test('renders a face from explicit options', (t) => {
  t.after(installFakeDom());

  const face = build({ color: '#533483', shape: 'square', eyeStyle: 'smooth' });
  const svg = face.getElement();

  assert.equal(svg.tagName, 'svg');
  assert.equal(svg.getAttribute('viewBox'), '0 0 100 100');

  const shape = svg.querySelector('.monako-face');
  assert.equal(shape.tagName, 'rect', 'square renders as a rect');
  assert.equal(shape.getAttribute('fill'), '#533483');

  const eyes = svg.querySelector('.monako-eyes');
  assert.equal(eyes.children.length, 2);
  assert.equal(eyes.children[0].tagName, 'ellipse', 'smooth eyes are ellipses');
});

test('pixel eyes render as rects with crisp edges', (t) => {
  t.after(installFakeDom());

  const face = build({ eyeStyle: 'pixel' });
  const svg = face.getElement();

  assert.equal(svg.getAttribute('shape-rendering'), 'crispEdges');
  assert.equal(svg.querySelector('.monako-eyes').children[0].tagName, 'rect');
});

test('a seed renders the face that seed derives', (t) => {
  t.after(installFakeDom());

  const traits = traitsFromSeed('naoki-bot');
  const face = build({ seed: 'naoki-bot' });
  const svg = face.getElement();

  assert.equal(svg.querySelector('.monako-face').getAttribute('fill'), traits.color);
  assert.equal(face.getTraits().emotion, traits.emotion);
  assert.equal(
    svg.querySelector('.monako-eyes').children[0].tagName,
    traits.eyeStyle === 'pixel' ? 'rect' : 'ellipse',
  );
});

test('a token renders the same face it was made from', (t) => {
  t.after(installFakeDom());

  const original = build({ seed: 'naoki-bot', emotion: 'love' });
  const token = original.toToken();
  assert.equal(token, 'monako:1;seed:naoki-bot;mood:love');

  const restored = build({ token });
  assert.deepEqual(restored.getTraits(), original.getTraits());
  assert.equal(
    restored.getElement().querySelector('.monako-face').getAttribute('fill'),
    original.getElement().querySelector('.monako-face').getAttribute('fill'),
  );
});

test('setters keep the token in step', (t) => {
  t.after(installFakeDom());

  const face = build({ seed: 'naoki-bot' });
  assert.equal(face.toToken(), 'monako:1;seed:naoki-bot');

  face.setEmotion('sad');
  assert.equal(face.toToken(), 'monako:1;seed:naoki-bot;mood:sad');

  face.setColor('#e94560');
  assert.equal(face.toToken(), 'monako:1;seed:naoki-bot;mood:sad;face:e94560');
  assert.equal(face.getElement().querySelector('.monako-face').getAttribute('fill'), '#e94560');
});

test('setShape swaps the rendered shape element', (t) => {
  t.after(installFakeDom());

  const face = build({ shape: 'circle' });
  assert.equal(face.getElement().querySelector('.monako-face').tagName, 'circle');

  face.setShape('rounded');
  const shape = face.getElement().querySelector('.monako-face');
  assert.equal(shape.tagName, 'rect');
  assert.equal(shape.getAttribute('rx'), '20');
});

test('angled emotions write a single composed transform', (t) => {
  t.after(installFakeDom());

  // 'angry' tilts and 'sad' droops. Both used to be written with separate
  // setAttribute calls onto the same attribute.
  for (const emotion of ['angry', 'sad']) {
    const face = build({ emotion });
    const eye = face.getElement().querySelector('.monako-eyes').children[0];
    assert.match(eye.getAttribute('transform'), /^rotate\(/, `${emotion} eye transform`);
  }

  const neutral = build({ emotion: 'neutral' });
  assert.equal(
    neutral.getElement().querySelector('.monako-eyes').children[0].getAttribute('transform'),
    null,
    'no angle means no transform attribute at all',
  );
});

test('the same seed renders identically twice, and different seeds differ', (t) => {
  t.after(installFakeDom());

  assert.deepEqual(build({ seed: 'a' }).getTraits(), build({ seed: 'a' }).getTraits());

  const faces = new Set();
  for (let i = 0; i < 40; i++) {
    faces.add(JSON.stringify(build({ seed: `agent-${i}` }).getTraits()));
  }
  assert.ok(faces.size > 30, `expected varied faces, got ${faces.size} distinct of 40`);
});

test('createMany produces faces that actually differ', async (t) => {
  t.after(installFakeDom());

  const { createMany } = await import('../dist/monako.esm.js');
  const faces = createMany(12, { ...QUIET, seed: 'batch' });

  const distinct = new Set(faces.map((f) => JSON.stringify(f.getTraits())));
  assert.equal(faces.length, 12);
  assert.ok(distinct.size > 8, `expected a varied batch, got ${distinct.size} distinct of 12`);
});

test('toSVG and toDataURL still work', (t) => {
  t.after(installFakeDom());

  // outerHTML is not something the fake element provides, so this asserts the
  // methods exist and delegate rather than checking their output.
  const face = build({});
  assert.equal(typeof face.toSVG, 'function');
  assert.equal(typeof face.toDataURL, 'function');
});

test('createMany ignores a token so the batch still varies', async (t) => {
  t.after(installFakeDom());

  // Tokens beat seeds inside resolveTraits, so a token left in baseOptions
  // pinned all `count` faces to the same one.
  const { createMany } = await import('../dist/monako.esm.js');
  const faces = createMany(8, { ...QUIET, seed: 'batch', token: 'monako:1;mood:happy' });

  const distinct = new Set(faces.map((f) => JSON.stringify(f.getTraits())));
  assert.ok(distinct.size > 5, `token pinned the batch: ${distinct.size} distinct of 8`);
});

test('createMany without a seed differs between calls', async (t) => {
  t.after(installFakeDom());

  // The per-face seeds used to fall back to the fixed strings '#0', '#1', …
  // so every call returned the same set.
  const { createMany } = await import('../dist/monako.esm.js');
  const first = createMany(4, QUIET).map((f) => JSON.stringify(f.getTraits()));
  const second = createMany(4, QUIET).map((f) => JSON.stringify(f.getTraits()));

  assert.notDeepEqual(first, second);
});

test('createMany with a seed is reproducible', async (t) => {
  t.after(installFakeDom());

  const { createMany } = await import('../dist/monako.esm.js');
  const first = createMany(4, { ...QUIET, seed: 'fixed' }).map((f) => f.toToken());
  const second = createMany(4, { ...QUIET, seed: 'fixed' }).map((f) => f.toToken());

  assert.deepEqual(first, second);
});
