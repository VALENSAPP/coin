/**
 * Ensures `src/shims/env.js` exists when Jest runs (Metro normally generates it).
 */
const {writeEnvShim} = require('../scripts/writeEnvShim');
writeEnvShim();
