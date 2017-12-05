/**
 * @module promise
 * @license MIT
 * @version 2017/12/05
 */

import Resolver from './resolver';
import { isFunction, isArray } from './utils';

/**
 * @class Promise
 * @constructor
 * @description
 *  A promise represents a value that may not yet be available. Promises allow
 *  you to chain asynchronous operations, write synchronous looking code and
 *  handle errors throughout the process.
 *  This constructor takes a function as a parameter where you can insert the logic
 *  that fulfills or rejects this promise. The fulfillment value and the rejection
 *  reason can be any JavaScript value. It's encouraged that rejection reasons be
 *  error objects
 * @example
 *  var fulfilled = new Promise(function (resolve) {
 *    resolve('I am a fulfilled promise');
 *  });
 *  var rejected = new Promise(function (resolve, reject) {
 *    reject(new Error('I am a rejected promise'));
 *  });
 * @param {Function} executor A function where to insert the logic that resolves this
 * promise. Receives `resolve` and `reject` functions as parameters.
 * This function is called synchronously.
 * @returns {Promise}
 */
function Promise(executor) {
  if (!(this instanceof Promise)) {
    throw new TypeError(this + 'is not a promise');
  }

  if (!isFunction(executor)) {
    throw new TypeError('Promise resolver ' + executor + ' is not a function');
  }

  var resolver = new Resolver();

  /**
   * @private
   * @type Object
   * @property _resolver
   * @description A reference to the resolver object that handles this promise
   */
  this._resolver = resolver;

  try {
    executor(
      function(value) {
        resolver.resolve(value);
      },
      function(reason) {
        resolver.reject(reason);
      }
    );
  } catch (error) {
    resolver.reject(error);
  }
}

Promise.prototype = {
  /**
   * @method then
   * @description
   *  Schedule execution of a callback to either or both of "fulfill" and
   *  "reject" resolutions for this promise. The callbacks are wrapped in a new
   *  promise and that promise is returned.  This allows operation chaining ala
   *  `functionA().then(functionB).then(functionC)` where `functionA` returns
   *  a promise, and `functionB` and `functionC` _may_ return promises.
   *  Asynchronicity of the callbacks is guaranteed.
   * @param {Function} [onFulfilled] function to execute if the promise resolves successfully
   * @param {Function} [onRejected] function to execute if the promise resolves unsuccessfully
   * @returns {Promise} A promise wrapping the resolution of either "resolve" or "reject" callback
   */
  then: function(onFulfilled, onRejected) {
    // Using this.constructor allows for customized promises to be returned instead of plain ones
    var resolve;
    var reject;
    var resolver = this._resolver;

    resolver._chained = true;

    var promise = new Promise(function(_resolve, _reject) {
      resolve = _resolve;
      reject = _reject;
    });

    resolver._addCallbacks(
      isFunction(onFulfilled) ? makeCallback(promise, resolve, reject, onFulfilled) : resolve,
      isFunction(onRejected) ? makeCallback(promise, resolve, reject, onRejected) : reject
    );

    return promise;
  },
  /**
   * @method catch
   * @description
   *  A shorthand for `promise.then(undefined, callback)`.
   *  Returns a new promise and the error callback gets the same treatment as in
   *  `then`: errors get caught and turned into rejections, and the return value
   *  of the callback becomes the fulfilled value of the returned promise.
   * @param {Function} onRejected Callback to be called in case this promise is rejected
   * @returns {Promise} A new promise modified by the behavior of the error callback
   */
  catch: function(onRejected) {
    return this.then(undefined, onRejected);
  }
};

/**
 * @static
 * @method resolve
 * @description
 *  Ensures that a certain value is a promise.
 *  If it is not a promise, it wraps it in one.
 *  This method can be copied or inherited in subclasses. In that case it will
 *  check that the value passed to it is an instance of the correct class.
 *  This means that `PromiseSubclass.resolve()` will always return instances of
 *  `PromiseSubclass`.
 * @param {any} value Object that may or may not be a promise
 * @returns {Promise}
 */
Promise.resolve = function(value) {
  if (value && value instanceof Promise) {
    return value;
  }

  return new Promise(function(resolve) {
    resolve(value);
  });
};

/**
 * @static
 * @method reject
 * @description A shorthand for creating a rejected promise.
 * @param {any} reason Reason for the rejection of this promise. Usually an Error Object
 * @returns {Promise} A rejected promise
 *
 */
Promise.reject = function(reason) {
  return new Promise(function(resolve, reject) {
    reject(reason);
  });
};

/**
 * @static
 * @method all
 * @description
 *  Returns a promise that is resolved or rejected when all values are resolved or
 *  any is rejected. This is useful for waiting for the resolution of multiple
 *  promises, such as reading multiple files in Node.js or making multiple XHR
 *  requests in the browser.
 * @param {any[]} iterable An array of any kind of values, promises or not. If a value is not
 * @returns {Promise} A promise for an array of all the fulfillment values
 */
Promise.all = function(iterable) {
  return new Promise(function(resolve, reject) {
    if (!isArray(iterable)) {
      return reject(new TypeError('Promise.all expects an array of values or promises'));
    }

    var i = 0;
    var results = [];
    var length = iterable.length;
    var remaining = iterable.length;

    function oneDone(index) {
      return function(value) {
        results[index] = value;

        remaining--;

        if (!remaining) {
          resolve(results);
        }
      };
    }

    if (length < 1) {
      return resolve(results);
    }

    for (; i < length; i++) {
      Promise.resolve(iterable[i]).then(oneDone(i), reject);
    }
  });
};

/**
 * @static
 * @method race
 * @description
 *  Returns a promise that is resolved or rejected when any of values is either
 *  resolved or rejected. Can be used for providing early feedback in the UI
 *  while other operations are still pending.
 * @param {any[]} iterable An array of values or promises
 * @return {Promise}
 */
Promise.race = function(iterable) {
  return new Promise(function(resolve, reject) {
    if (!isArray(iterable)) {
      return reject(new TypeError('Promise.race expects an array of values or promises'));
    }

    // Just go through the list and resolve and reject at the first change
    // This abuses the fact that calling resolve/reject multiple times
    // doesn't change the state of the returned promise
    for (var i = 0, count = iterable.length; i < count; i++) {
      Promise.resolve(iterable[i]).then(resolve, reject);
    }
  });
};

/**
 * @function makeCallback
 * @description Wraps the callback in another function to catch exceptions and turn them into rejections.
 * @param {Promise} promise Promise that will be affected by this callback
 * @param {Function} resolve Promise resolve
 * @param {Function} reject Promise reject
 * @param {Function} callback Callback to wrap
 * @returns {Function}
 */
function makeCallback(promise, resolve, reject, callback) {
  // Make resolve and reject only get one argument
  return function(valueOrReason) {
    var result;

    // Promises model exception handling through callbacks
    // making both synchronous and asynchronous errors behave
    // the same way
    try {
      // Use the argument coming in to the callback/errback from the
      // resolution of the parent promise.
      // The function must be called as a normal function, with no
      // special value for |this|, as per Promises A+
      result = callback(valueOrReason);
    } catch (error) {
      // Calling return only to stop here
      return reject(error);
    }

    if (result === promise) {
      return reject(new TypeError('Cannot resolve a promise with itself'));
    }

    resolve(result);
  };
}

this.Promise = Promise;
