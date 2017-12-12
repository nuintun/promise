/**
 * @module resolver
 * @license MIT
 * @version 2017/12/05
 */

import microtask from './microtask/index';
import { isFunction, printError } from './utils';

/**
 * @class Resolver
 * @constructor
 * @description
 *  Represents an asynchronous operation. Provides a
 *  standard API for subscribing to the moment that the operation completes either
 *  successfully (`fulfilled()`) or unsuccessfully (`reject()`).
 */
export default function Resolver() {
  /**
   * @private
   * @type {Array}
   * @property callbacks
   * @description List of success callbacks
   */
  this.callbacks = [];

  /**
   * @private
   * @type {Array}
   * @property errbacks
   * @description List of failure callbacks
   */
  this.errbacks = [];

  /**
   * @private
   * @type {string}
   * @property state
   * @default 'pending'
   * @description
   *  The state of the operation. This property may take only one of the following
   *  values: 'pending', 'fulfilled' or 'rejected'.
   */
  this.state = 'pending';

  /**
   * @private
   * @type {any}
   * @property value
   * @description This value that this promise represents.
   */
  this.value = null;

  /**
   * @private
   * @type {boolean}
   * @property chained
   * @description This value that promise has chained.
   */
  this.chained = false;
}

Resolver.prototype = {
  /**
   * @protected
   * @method fulfilled
   * @description
   *  Resolves the promise, signaling successful completion of the
   *  represented operation. All "onFulfilled" subscriptions are executed and passed
   *  the value provided to this method. After calling `fulfilled()`, `reject()` and
   *  `notify()` are disabled.
   * @param {any} value Value to pass along to the "onFulfilled" subscribers
   */
  fulfilled: function(value) {
    if (this.state === 'pending') {
      this.value = value;
      this.state = 'fulfilled';
    }

    if (this.state === 'fulfilled') {
      this.notify(this.callbacks, this.value);

      // Reset the callback list so that future calls to fulfilled()
      // won't call the same callbacks again. Promises keep a list
      // of callbacks, they're not the same as events. In practice,
      // calls to fulfilled() after the first one should not be made by
      // the user but by then()
      this.callbacks = [];

      // Once a promise gets fulfilled it can't be rejected, so
      // there is no point in keeping the list. Remove it to help
      // garbage collection
      this.errbacks = null;
    }
  },
  /**
   * @protected
   * @method rejected
   * @description
   *  Resolves the promise, signaling unsuccessful completion of the
   *  represented operation. All "onRejected" subscriptions are executed with
   *  the value provided to this method. After calling `rejected()`, `resolve()`
   *  and `notify()` are disabled.
   * @param {any} reason Value to pass along to the "onRejected" subscribers
   */
  rejected: function(reason) {
    if (this.state === 'pending') {
      this.value = reason;
      this.state = 'rejected';
    }

    if (this.state === 'rejected') {
      this.notify(this.errbacks, this.value);

      // See fulfilled()
      this.callbacks = null;
      this.errbacks = [];
    }
  },
  /**
   * @protected
   * @method resolve
   * @description
   *  Given a certain value A passed as a parameter, this method resolves the
   *  promise to the value A.
   *  If A is a promise, `resolve` will cause the resolver to adopt the state of A
   *  and once A is resolved, it will resolve the resolver's promise as well.
   *  This behavior "flattens" A by calling `then` recursively and essentially
   *  disallows promises-for-promises.
   *  This is the default algorithm used when using the function passed as the
   *  first argument to the promise initialization function. This means that
   *  the following code returns a promise for the value 'hello world'
   * @example
   *  var promise1 = new Promise(function (resolve) {
   *    resolve('hello world');
   *  });
   *  var promise2 = new Promise(function (resolve) {
   *    resolve(promise1);
   *  });
   *  promise2.then(function (value) {
   *    assert(value === 'hello world'); // true
   *  });
   * @param {any} value A promise, thenable or regular value
   *  If `value` is a promise or a thenable, it will be unwrapped by
   *  recursively calling its `then` method. If not, the resolver will be
   *  fulfilled with `value`.
   */
  resolve: function(value) {
    var self = this;

    if (self.state === 'pending') {
      if (!value || (typeof value !== 'object' && !isFunction(value))) {
        return self.fulfilled(value);
      }

      // Is promise or thenable unwrapped
      var unwrapped = false;

      // Exec promise or thenable then method
      try {
        // If then is function
        if (isFunction(value.then)) {
          value.then(
            function(value) {
              if (!unwrapped) {
                unwrapped = true;

                // Use resolve not fulfilled because this function maybe called async
                self.resolve(value);
              }
            },
            function(reason) {
              if (!unwrapped) {
                unwrapped = true;

                // Use reject not rejected because this function maybe called async
                self.reject(reason);
              }
            }
          );
        } else {
          self.fulfilled(value);
        }
      } catch (error) {
        if (!unwrapped) {
          self.rejected(error);
        }
      }
    }
  },
  /**
   * @protected
   * @method reject
   * @description Resolves the promise, signaling unsuccessful completion of the represented operation.
   * @param {any} reason
   */
  reject: function(reason) {
    if (this.state === 'pending') {
      this.rejected(reason);
    }
  },
  /**
   * @protected
   * @method addCallbacks
   * @description
   *  Schedule execution of a callback to either or both of "resolve" and
   *  "reject" resolutions of this resolver. If the resolver is not pending,
   *  the correct callback gets called automatically.
   * @param {Function} [callback] function to execute if the Resolver resolves successfully
   * @param {Function} [errback] function to execute if the Resolver resolves unsuccessfully
   */
  addCallbacks: function(callback, errback) {
    var chained = false;
    var callbacks = this.callbacks;
    var errbacks = this.errbacks;

    // Because the callback and errback are represented by a Resolver, it
    // must be fulfilled or rejected to propagate through the then() chain.
    // The same logic applies to resolve() and reject() for fulfillment.
    if (callbacks) {
      chained = true;

      // Push to callbacks queue
      callbacks.push(callback);
    }

    if (errbacks) {
      chained = true;

      // Push to errback queue
      errbacks.push(errback);
    }

    if (chained) {
      this.chained = chained;

      switch (this.state) {
        case 'fulfilled':
          this.fulfilled(this.value);
          break;
        case 'rejected':
          this.rejected(this.value);
          break;
      }
    }
  },
  /**
   * @protected
   * @method notify
   * @description Executes an array of callbacks from a specified context, passing a set of arguments.
   * @param {Function[]} callbacks The array of subscriber callbacks
   * @param {any} result Value to pass the callbacks
   */
  notify: function(callbacks, value) {
    // Since callback lists are reset synchronously, the callbacks list never
    // changes after notify() receives it.
    microtask(function(self) {
      // Calling all callbacks after microtask to guarantee
      // asynchronicity. Because setTimeout can cause unnecessary
      // delays that *can* become noticeable in some situations
      // (especially in Node.js)
      if (callbacks.length) {
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i](value);
        }
      }

      // If non catch by user call default uncaught method
      if (!self.chained && self.state === 'rejected') {
        self.uncaught();
      }
    }, this);
  },
  /**
   * @protected
   * @method uncaught
   * @deprecated Output uncaught error
   */
  uncaught: function() {
    var error = this.value;

    if (error instanceof Error) {
      printError('Uncaught', error.stack || error.name + ': ' + error.message);
    } else {
      printError('Uncaught Error:', error);
    }
  }
};
