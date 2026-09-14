import { Monako } from './Monako.js';
import { emotions } from './emotions.js';

export { Monako, emotions };

/**
 * Create a Monako face
 * @param {Object} options - Configuration options
 * @returns {Monako}
 */
export function createMonako(options) {
  return new Monako(options);
}

/**
 * Create multiple random Monako faces
 * @param {number} count - Number of faces to create
 * @param {Object} baseOptions - Base options for all faces
 * @returns {Monako[]}
 */
export function createMany(count, baseOptions = {}) {
  const faces = [];
  for (let i = 0; i < count; i++) {
    faces.push(new Monako({
      ...baseOptions,
      seed: baseOptions.seed ? baseOptions.seed + i : null,
    }));
  }
  return faces;
}

// Default export for convenience
export default Monako;
