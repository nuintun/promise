/**
 * @module finally
 * @license MIT
 * @version 2018/04/27
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
