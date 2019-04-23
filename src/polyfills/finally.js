/**
 * @module finally
 * @author nuintun
 * @license MIT
 */

/**
 * @function finally
 * @description Appends a handler to the promise, and returns a new promise which is resolved when
 *  the original promise is resolved. The handler is called when the promise is settled,
 *  whether fulfilled or rejected.
 * @param {Function} onFinally A Function called when the Promise is settled
 * @returns {Promise} Returns a Promise whose finally handler is set to the specified function, onFinally
 */
export default function always(onFinally) {
  var Promise = this.constructor;

  // Must be a function
  if (typeof onFinally !== 'function') {
    return this;
  }

  // Finally
  return this.then(
    function(value) {
      return Promise.resolve(onFinally()).then(function() {
        return value;
      });
    },
    function(reason) {
      return Promise.resolve(onFinally()).then(function() {
        throw reason;
      });
    }
  );
}
