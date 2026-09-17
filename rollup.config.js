import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const banner = `/*!
 * Monako
 * Lightweight animated faces with expressive eyes
 * https://github.com/rosvelthq/monako
 * MIT License
 */`;

// The TypeScript plugin never emits declarations: those come from one
// `tsc` pass in `npm run build:types`. Letting each of the seven builds below
// emit them would have them racing to write the same files.
const ts = () =>
  typescript({ tsconfig: './tsconfig.json', declaration: false, noEmit: false });

// Vanilla builds
const vanillaBuilds = [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/monako.esm.js',
      format: 'esm',
      banner,
    },
    plugins: [ts()],
  },
  // ESM minified
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/monako.esm.min.js',
      format: 'esm',
      banner,
    },
    plugins: [ts(), terser()],
  },
  // UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/monako.umd.js',
      format: 'umd',
      name: 'Monako',
      exports: 'named',
      banner,
    },
    plugins: [ts()],
  },
  // UMD minified
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/monako.umd.min.js',
      format: 'umd',
      name: 'Monako',
      exports: 'named',
      banner,
    },
    plugins: [ts(), terser()],
  },
];

// React builds
//
// `declaration: false` everywhere below is deliberate, not an oversight: the
// .d.ts files are emitted in one pass by `npm run build:types` (see
// tsconfig.types.json), which also covers the plain-JS sources. Turning it on
// here would have each of the three builds race to write the same files.
const reactBuilds = [
  // ESM
  {
    input: 'src/MonakoReact.tsx',
    output: {
      file: 'dist/monako-react.esm.js',
      format: 'esm',
      banner,
    },
    external: ['react', 'react/jsx-runtime'],
    plugins: [
      ts(),
    ],
  },
  // ESM minified
  {
    input: 'src/MonakoReact.tsx',
    output: {
      file: 'dist/monako-react.esm.min.js',
      format: 'esm',
      banner,
    },
    external: ['react', 'react/jsx-runtime'],
    plugins: [
      ts(),
      terser(),
    ],
  },
  // UMD
  {
    input: 'src/MonakoReact.tsx',
    output: {
      file: 'dist/monako-react.umd.js',
      format: 'umd',
      name: 'MonakoReact',
      exports: 'named',
      globals: {
        react: 'React',
        'react/jsx-runtime': 'jsxRuntime',
      },
      banner,
    },
    external: ['react', 'react/jsx-runtime'],
    plugins: [
      ts(),
    ],
  },
];

export default [...vanillaBuilds, ...reactBuilds];
