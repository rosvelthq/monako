import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const banner = `/*!
 * Monako v0.1.0
 * Lightweight animated faces with expressive eyes
 * https://github.com/your-username/monako
 * MIT License
 */`;

// Vanilla JS builds
const vanillaBuilds = [
  // ESM build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/monako.esm.js',
      format: 'esm',
      banner,
    },
  },
  // ESM minified
  {
    input: 'src/index.js',
    output: {
      file: 'dist/monako.esm.min.js',
      format: 'esm',
      banner,
    },
    plugins: [terser()],
  },
  // UMD build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/monako.umd.js',
      format: 'umd',
      name: 'Monako',
      exports: 'named',
      banner,
    },
  },
  // UMD minified
  {
    input: 'src/index.js',
    output: {
      file: 'dist/monako.umd.min.js',
      format: 'umd',
      name: 'Monako',
      exports: 'named',
      banner,
    },
    plugins: [terser()],
  },
];

// React builds
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
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
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
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
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
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
  },
];

export default [...vanillaBuilds, ...reactBuilds];
