/**
 * @module intro
 * @license MIT
 * @version 2018/04/27
 */

import always from './polyfills/finally';

// Use native Promise
if (typeof this.Promise === 'function') {
  // Polyfill finally
  if (typeof this.Promise.prototype.finally !== 'function') {
    this.Promise.prototype.finally = always;
  }

  return;
}
