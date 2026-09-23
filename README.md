# Monako

Lightweight animated faces with expressive eyes. Perfect for tables, agents, avatars, and anywhere you need personality.

<p align="center">
  <img src="https://github.com/user-attachments/assets/5076b5a0-32b7-408f-9012-40662a78c340" alt="monako" width="100%" />
</p>

## Install

```bash
npm install monako
```

## Usage

```javascript
import { Monako } from 'monako';

// Create a face
const face = new Monako({
  container: '#my-container',
  size: 100,
  color: '#000000',
  emotion: 'happy',
});

// Change emotion
face.setEmotion('surprised');

// Trigger a blink
face.blink();

// Make it look somewhere
face.lookAt(0.8, 0.3); // x, y from 0-1
```

## Identity: seeds and tokens

A face is five traits — shape, eye style, emotion, face colour, eye colour. Monako gives you two ways to pin one down, and they compose.

### Seeds

Pass any string and get a face back. The same string always gives the same face, so an id you already have is enough — nothing to store, nothing to migrate.

```javascript
const face = new Monako({ container: '#app', seed: agent.id });

// Or just the traits, no DOM involved:
Monako.fromSeed('naoki-bot');
// → { shape: 'rounded', eyeStyle: 'pixel', emotion: 'curious',
//     color: '#2980b9', eyeColor: '#ffe9a8' }
```

The hash runs over UTF-8 bytes, so a backend in another language can derive the identical face from the identical seed.

### Tokens

When someone picks a face by hand, serialise it. A token is one short string for one database column.

```javascript
face.toToken();                    // 'monako:1;seed:naoki-bot;mood:love'
Monako.toToken({ emotion: 'happy', color: '#533483' });
                                   // 'monako:1;mood:happy;face:533483'

new Monako({ container: '#app', token: storedToken });
```

A token is shaped like a CSS rule: `key:value` declarations separated by `;`, with the version as one of the declarations. Keys rather than positions is what makes it survive change — appending a trait or reordering the registry leaves old tokens reading the same:

```
monako:1                           nothing stated — the default face
monako:1;seed:naoki-bot            derived — every trait comes from the seed
monako:1;mood:happy;face:533483    explicit — the user picked this
monako:1;seed:naoki-bot;mood:love  derived, with one trait overridden

mood:happy                         no version — assume the current one
```

**The version is optional when reading, always written when writing.** Leaving `monako:` off is a convenience for hand-written tokens; `toToken` never omits it. A stored token that does not pin its version gets reinterpreted by whatever registry ships next, and the whole point of freezing the registries is that a saved face never changes under its owner.

Only what differs from the default (or from what the seed already gives) is written, so tokens stay short.

**Writing is strict.** A token holds hex colours and registry values, nothing else. Rather than drop what it cannot represent — and hand back a token that renders a *different* face than the one being serialised — `toToken` throws:

```javascript
Monako.toToken({ color: 'var(--brand)' });  // throws: a token holds hex colours only
Monako.toToken({ emotion: 'banana' });      // throws: expected one of neutral, happy, …
```

Non-hex fills stay perfectly legal as explicit options; they just cannot go in a token.

**Reading is forgiving, by design.** An unknown key is ignored and an unknown value falls back to the seeded or default one, so a token written by a newer version never breaks an older reader. Only structural garbage throws:

```javascript
Monako.fromToken('monako:1;mood:happy;hat:fedora').emotion;  // 'happy' — 'hat' ignored
Monako.fromToken('monako:1;mood:wink').emotion;              // 'neutral' — unknown value
Monako.fromToken('not a token');                        // throws TypeError

Monako.isValidToken(rowFromDatabase);                   // guard storage reads
```

### Precedence

```
defaults  <  seed  <  token  <  explicit options
```

A token contributes **only the traits it names** — it layers over the seed rather than replacing it, so one customised trait never costs you the rest of the derived face. A token carrying its own `seed:` is the exception: that is a complete statement, and it re-bases everything.

```javascript
Monako.fromSeed('naoki-bot');
// → rounded / pixel / curious / #2980b9

new Monako({ seed: 'naoki-bot', token: 'monako:1;mood:happy' }).getTraits();
// → rounded / pixel / happy / #2980b9      only the emotion moved
```

So the usual pattern for "let people customise, but always have something to show" is one line, and the column can be null:

```javascript
<MonakoFace seed={agent.id} token={agent.avatarFace} />
```

### Versioning

`monako:1` is the wire format, and a token declaring any other version is refused rather than guessed at. The trait registries in [`src/traits.js`](src/traits.js) are **append-only**: reordering or removing an entry silently rewrites faces that are already saved in somebody's database. If you need to do that, leave `monako:1` alone and add `monako:2` beside it. `test/identity.test.js` pins the seed→face mapping with golden values and will fail loudly if it ever shifts.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `size` | number | 100 | Size in pixels |
| `color` | string | '#000000' | Face color |
| `eyeColor` | string | '#ffffff' | Eye color |
| `emotion` | string | 'neutral' | Initial emotion |
| `shape` | string | 'circle' | `circle`, `square` or `rounded` |
| `eyeStyle` | string | 'smooth' | `smooth` (ellipse) or `pixel` (rect) |
| `followCursor` | boolean | true | Eyes follow mouse |
| `autoAnimate` | boolean | true | Auto blink and animate |
| `container` | Element/string | null | Container element |
| `seed` | string \| number | null | Derives every trait not passed explicitly, and seeds the blink rhythm |
| `token` | string | null | A `monako:1` token. Beats `seed`, loses to explicit traits |

## Emotions

- `neutral` - Default calm expression
- `happy` - Slightly squinted, cheerful
- `sad` - Droopy, downcast
- `surprised` - Wide eyes
- `angry` - Tilted, intense
- `sleepy` - Heavy-lidded
- `curious` - Asymmetric, inquisitive
- `love` - Soft, warm gaze

## API

### Instance Methods

```javascript
face.setEmotion('happy')     // Change emotion
face.randomEmotion()         // Random emotion
face.blink()                 // Trigger blink
face.lookAt(x, y)            // Look at point (0-1)
face.setColor('#ff0000')     // Change face color
face.setEyeColor('#00ff00')  // Change eye color
face.setShape('rounded')     // Change face shape
face.setEyeStyle('pixel')    // Change eye style
face.setSize(150)            // Change size
face.getTraits()             // Current traits
face.toToken()               // Current traits as a token
face.getElement()            // Get SVG element
face.toSVG()                 // Export as SVG string
face.toDataURL()             // Export as data URL
face.destroy()               // Cleanup
```

### Static Methods

```javascript
Monako.getEmotions()         // List of emotions, in registry order
Monako.getShapes()           // List of shapes
Monako.getEyeStyles()        // List of eye styles

Monako.fromSeed(seed)        // Derive traits from a seed
Monako.fromToken(token)      // Decode a token to traits
Monako.toToken(traits)       // Encode traits to a token
Monako.isValidToken(value)   // Whether a value decodes
```

### Helper Functions

```javascript
import { createMonako, createMany } from 'monako';

const face = createMonako({ size: 80 });

// Each face is seeded with `${seed}#${i}`, so the batch is varied and
// reproducible as a whole.
const faces = createMany(5, { seed: 'team', color: '#333' });
```

## React

```jsx
import { MonakoFace } from 'monako/react';

<MonakoFace seed={agent.id} token={agent.avatarFace} size={40} />;
```

Trait props (`color`, `emotion`, `shape`, `eyeStyle`, `eyeColor`) override whatever `seed` and `token` resolve to. Unlike the `Monako` class, a token the component cannot parse warns and falls back rather than throwing — that value usually arrives from a database, and one bad row should not blank the page.

The ref exposes the imperative API plus `getTraits()` and `toToken()`.

## CDN

```html
<script src="https://unpkg.com/monako/dist/monako.umd.min.js"></script>
<script>
  const face = new Monako.Monako({
    container: '#app',
    size: 100
  });
</script>
```

## Development

```bash
npm test          # node:test, no browser needed
npm run build     # types (tsc) + bundles (rollup)
```

`dist/` is committed and CI fails if it drifts from `src/`. TypeScript declarations are **generated** from the JSDoc in `src/` — never hand-edit anything in `dist/types/`.

## License

MIT
