# Monako

Lightweight animated faces with expressive eyes. Perfect for tables, agents, avatars, and anywhere you need personality.

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

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `size` | number | 100 | Size in pixels |
| `color` | string | '#000000' | Face color |
| `eyeColor` | string | '#ffffff' | Eye color |
| `emotion` | string | 'neutral' | Initial emotion |
| `followCursor` | boolean | true | Eyes follow mouse |
| `autoAnimate` | boolean | true | Auto blink and animate |
| `container` | Element/string | null | Container element |
| `seed` | number | null | Seed for reproducible faces |

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
face.setSize(150)            // Change size
face.getElement()            // Get SVG element
face.toSVG()                 // Export as SVG string
face.toDataURL()             // Export as data URL
face.destroy()               // Cleanup
```

### Static Methods

```javascript
Monako.getEmotions()  // Get list of emotions
```

### Helper Functions

```javascript
import { createMonako, createMany } from 'monako';

const face = createMonako({ size: 80 });
const faces = createMany(5, { color: '#333' });
```

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

## License

MIT
