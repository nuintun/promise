(function () {
  'use strict';

  if (window.Promise) return;

  /**
   * @module utils
   * @license MIT
   * @version 2017/12/04
   */

  var toString = Object.prototype.toString;

  /**
   * @function isFunction
   * @param {any} value
   * @returns {boolean}
   */
  function isFunction(value) {
    return typeof value === 'function';
  }

  /**
   * @function isArray
   * @param {any} value
   * @returns {boolean}
   */
  var isArray = isFunction(Array.isArray)
    ? Array.isArray
    : function(value) {
        return toString.call(value) === '[object Array]';
      };

  /**
   * @module native
   * @license MIT
   * @version 2017/12/04
   */

  // Used to match `RegExp`
  // [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
  var REGEXP_CHAR_RE = /[\\^$.*+?()[\]{}|]/g;

  // Used to detect if a method is native
  var IS_NATIVE_RE = Function.prototype.toString.call(Function);

  IS_NATIVE_RE = IS_NATIVE_RE.replace(REGEXP_CHAR_RE, '\\$&');
  IS_NATIVE_RE = IS_NATIVE_RE.replace(/Function|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?');
  IS_NATIVE_RE = new RegExp('^' + IS_NATIVE_RE + '$');

  /**
   * @function native
   * @param {any} value
   * @returns {boolean}
   */
  function native(value) {
    return typeof value === 'function' && IS_NATIVE_RE.test(value);
  }

  /**
   * @module mutation
   * @license MIT
   * @version 2017/12/04
   */

  var Mutation = window.MutationObserver || window.WebKitMutationObserver;

  var mutation = {
    /**
     * @method support
     * @returns {boolean}
     */
    support: function() {
      return native(Mutation);
    },
    /**
     * @method install
     * @param {Function} handler
     * @returns {Function}
     */
    install: function(handler) {
      var called = 0;
      var observer = new Mutation(handler);
      var element = document.createTextNode('');

      observer.observe(element, {
        characterData: true
      });

      return function() {
        element.data = called = ++called % 2;
      };
    }
  };

  /**
   * @module channel
   * @license MIT
   * @version 2017/12/04
   */

  var VBArray = window.VBArray;
  var MessageChannel = window.MessageChannel;

  var channel = {
    /**
     * @method support
     * @returns {boolean}
     */
    support: function() {
      // IE MessageChannel slower than image error
      return !native(VBArray) && native(MessageChannel);
    },
    /**
     * @method install
     * @param {Function} handler
     * @returns {Function}
     */
    install: function(handler) {
      var channel = new MessageChannel();

      channel.port1.onmessage = handler;

      return function() {
        channel.port2.postMessage(0);
      };
    }
  };

  /**
   * @module image
   * @license MIT
   * @version 2017/12/04
   */

  var image = {
    /**
     * @method support
     * @returns {boolean}
     */
    support: function() {
      return true;
    },
    /**
     * @method install
     * @param {Function} handler
     * @returns {Function}
     */
    install: function(handler) {
      var image = new Image();

      image.onerror = handler;

      return function() {
        image.src = '';
      };
    }
  };

  /**
   * @module task
   * @license MIT
   * @version 2017/12/04
   */

  /**
   * @class Task
   * @constructor
   * @param {Function} task
   * @param {Array} args
   * @returns {Task}
   */
  function Task(task, args) {
    this.task = task;
    this.args = args;
  }

  /**
   * @method run
   */
  Task.prototype.run = function() {
    var task = this.task;
    var args = this.args;

    switch (args.length) {
      case 0:
        return task();
      case 1:
        return task(args[0]);
      case 2:
        return task(args[0], args[1]);
      case 3:
        return task(args[0], args[1], args[2]);
      default:
        return task.apply(null, args);
    }
  };

  /**
   * @module index
   * @license MIT
   * @version 2017/12/04
   */

  var schedule;
  var queue = [];
  var slice = Array.prototype.slice;
  // Use chain: mutation > channel > image
  var schedules = [mutation, channel, image];

  /**
   * @function nextTick
   */
  function nextTick() {
    var buffer = queue;

    queue = [];

    for (var i = 0, length = buffer.length; i < length; i++) {
      buffer[i].run();
    }
  }

  // Install schedule
  for (var i = 0, length = schedules.length; i < length; i++) {
    schedule = schedules[i];

    if (schedule.support()) {
      schedule = schedule.install(nextTick);

      break;
    }
  }

  /**
   * @function microtask
   * @param {Function} task
   */
  function microtask(task) {
    var args = slice.call(arguments, 1);

    queue.push(new Task(task, args));

    schedule();
  }

  /**
   * @module resolver
   * @license MIT
   * @version 2017/12/04
   */

  /**
   * @class Resolver
   * @constructor
   * @description
   *  Represents an asynchronous operation. Provides a
   *  standard API for subscribing to the moment that the operation completes either
   *  successfully (`fulfill()`) or unsuccessfully (`reject()`).
   */
  function Resolver() {
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
     * @property _result
     * @description This value that this promise represents.
     */
    this._result = null;
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
        this._result = value;
        this._status = 'fulfilled';
      }

      if (this._status === 'fulfilled') {
        this._notify(this._callbacks, this._result);

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
        this._result = reason;
        this._status = 'rejected';
      }

      if (this._status === 'rejected') {
        this._notify(this._errbacks, this._result);

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
      var then;
      var self = this;
      var unwrapped = false;

      if (!value || (typeof value !== 'object' && !isFunction(value))) {
        return self.fulfill(value);
      }

      try {
        then = value.then;

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
      var callbackList = this._callbacks;
      var errbackList = this._errbacks;

      // Because the callback and errback are represented by a Resolver, it
      // must be fulfilled or rejected to propagate through the then() chain.
      // The same logic applies to resolve() and reject() for fulfillment.
      if (callbackList) {
        callbackList.push(callback);
      }

      if (errbackList) {
        errbackList.push(errback);
      }

      switch (this._status) {
        case 'accepted':
          this._unwrap(this._value);
          break;
        case 'fulfilled':
          this.fulfill(this._result);
          break;
        case 'rejected':
          this.reject(this._result);
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
      // changes after _notify() receives it. Avoid calling Y.soon() for
      // an empty list
      if (subs.length) {
        // Calling all callbacks after microtask to guarantee
        // asynchronicity. Because setTimeout can cause unnecessary
        // delays that *can* become noticeable in some situations
        // (especially in Node.js)
        microtask(function() {
          for (var i = 0, len = subs.length; i < len; ++i) {
            subs[i](result);
          }
        });
      }
    }
  };

  /**
   * @module promise
   * @license MIT
   * @version 2017/12/04
   */

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

      var promise = new Promise(function(_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
      });

      this._resolver._addCallbacks(
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
    if (value && value.constructor === Promise) {
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
    var promise = new Promise(function() {});

    // Do not go through resolver.reject() because an immediately rejected promise
    // always has no callbacks which would trigger an unnecessary warning
    var resolver = promise._resolver;

    resolver._result = reason;
    resolver._status = 'rejected';

    return promise;
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

  window.Promise = Promise;

}());
