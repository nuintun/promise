/**
 * @module resolver
 * @license MIT
 * @version 2017/12/04
 */

import microtask from './microtask/index';
import { isFunction, printError } from './utils';

/**
 * @class Resolver
 * @constructor
 * @description
 *  Represents an asynchronous operation. Provides a
 *  standard API for subscribing to the moment that the operation completes either
 *  successfully (`fulfill()`) or unsuccessfully (`reject()`).
 */
export default function Resolver() {
  /**
   * @private
   * @type {Array}
   * @property _callbacks
   * @description List of success callbacks
   */
  this._callbacks = [];

  /**
   * @private
   * @type {Array}
   * @property _errbacks
   * @description List of failure callbacks
   */
  this._errbacks = [];

  /**
   * @private
   * @type {string}
   * @property _status
   * @default 'pending'
   * @description
   *  The status of the operation. This property may take only one of the following
   *  values: 'pending', 'fulfilled' or 'rejected'.
   */
  this._status = 'pending';

  /**
   * @private
   * @type {any}
   * @property _value
   * @description This value that this promise represents.
   */
  this._value = null;

  /**
   * @private
   * @type {boolean}
   * @property _chained
   * @description This value that promise has chained.
   */
  this._chained = false;
}

Resolver.prototype = {
  /**
   * @method fulfill
   * @description
   *  Resolves the promise, signaling successful completion of the
   *  represented operation. All "onFulfilled" subscriptions are executed and passed
   *  the value provided to this method. After calling `fulfill()`, `reject()` and
   *  `notify()` are disabled.
   * @param {any} value Value to pass along to the "onFulfilled" subscribers
   */
  fulfill: function(value) {
    var status = this._status;

    if (status === 'pending' || status === 'accepted') {
      this._value = value;
      this._status = 'fulfilled';
    }

    if (this._status === 'fulfilled') {
      this._notify(this._callbacks, this._value);

      // Reset the callback list so that future calls to fulfill()
      // won't call the same callbacks again. Promises keep a list
      // of callbacks, they're not the same as events. In practice,
      // calls to fulfill() after the first one should not be made by
      // the user but by then()
      this._callbacks = [];

      // Once a promise gets fulfilled it can't be rejected, so
      // there is no point in keeping the list. Remove it to help
      // garbage collection
      this._errbacks = null;
    }
  },
  /**
   * @method reject
   * @description
   *  Resolves the promise, signaling *un*successful completion of the
   *  represented operation. All "onRejected" subscriptions are executed with
   *  the value provided to this method. After calling `reject()`, `resolve()`
   *  and `notify()` are disabled.
   * @param {any} reason Value to pass along to the "reject" subscribers
   */
  reject: function(reason) {
    var status = this._status;

    if (status === 'pending' || status === 'accepted') {
      this._value = reason;
      this._status = 'rejected';
    }

    if (this._status === 'rejected') {
      this._notify(this._errbacks, this._value);

      // See fulfill()
      this._callbacks = null;
      this._errbacks = [];
    }
  },
  /**
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
   *  the following code returns a promise for the value 'hello world':
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
   * @param {any} value A regular JS value or a promise
   */
  resolve: function(value) {
    if (this._status === 'pending') {
      this._status = 'accepted';
      this._value = value;

      if ((this._callbacks && this._callbacks.length) || (this._errbacks && this._errbacks.length)) {
        this._unwrap(this._value);
      }
    }
  },
  /**
   * @private
   * @method _unwrap
   * @description
   *  If `value` is a promise or a thenable, it will be unwrapped by
   *  recursively calling its `then` method. If not, the resolver will be
   *  fulfilled with `value`.
   *  This method is called when the promise's `then` method is called and
   *  not in `resolve` to allow for lazy promises to be accepted and not
   *  resolved immediately.
   * @param {any} value A promise, thenable or regular value
   */
  _unwrap: function(value) {
    var self = this;
    var unwrapped = false;

    if (!value || (typeof value !== 'object' && !isFunction(value))) {
      return self.fulfill(value);
    }

    try {
      var then = value.then;

      if (isFunction(then)) {
        then.call(
          value,
          function(value) {
            if (!unwrapped) {
              unwrapped = true;

              self._unwrap(value);
            }
          },
          function(reason) {
            if (!unwrapped) {
              unwrapped = true;

              self.reject(reason);
            }
          }
        );
      } else {
        self.fulfill(value);
      }
    } catch (error) {
      if (!unwrapped) {
        self.reject(error);
      }
    }
  },
  /**
   * @method _addCallbacks
   * @description
   *  Schedule execution of a callback to either or both of "resolve" and
   *  "reject" resolutions of this resolver. If the resolver is not pending,
   *  the correct callback gets called automatically.
   * @param {Function} [callback] function to execute if the Resolver resolves successfully
   * @param {Function} [errback] function to execute if the Resolver resolves unsuccessfully
   */
  _addCallbacks: function(callback, errback) {
    var callbacks = this._callbacks;
    var errbacks = this._errbacks;

    // Because the callback and errback are represented by a Resolver, it
    // must be fulfilled or rejected to propagate through the then() chain.
    // The same logic applies to resolve() and reject() for fulfillment.
    if (callbacks) {
      callbacks.push(callback);
    }

    if (errbacks) {
      errbacks.push(errback);
    }

    switch (this._status) {
      case 'accepted':
        this._unwrap(this._value);
        break;
      case 'fulfilled':
        this.fulfill(this._value);
        break;
      case 'rejected':
        this.reject(this._value);
        break;
    }
  },
  /**
   * @protected
   * @method _notify
   * @description Executes an array of callbacks from a specified context, passing a set of arguments.
   * @param {Function[]} subs The array of subscriber callbacks
   * @param {any} result Value to pass the callbacks
   */
  _notify: function(subs, result) {
    // Since callback lists are reset synchronously, the subs list never
    // changes after _notify() receives it.
    microtask(function(self) {
      // Calling all callbacks after microtask to guarantee
      // asynchronicity. Because setTimeout can cause unnecessary
      // delays that *can* become noticeable in some situations
      // (especially in Node.js)
      if (subs.length) {
        for (var i = 0, len = subs.length; i < len; ++i) {
          subs[i](result);
        }
      }

      // If non catch by user call default _uncaught method
      if (!self._chained && self._status === 'rejected') {
        self._uncaught();
      }
    }, this);
  },
  /**
   * @private
   * @method _uncaught
   * @deprecated Output uncaught error
   */
  _uncaught: function() {
    var error = this._value;

    printError('Uncaught', error.stack || error.name + ': ' + error.message);
  }
};
