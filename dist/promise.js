/**
* @module promise
* @author nuintun
* @license MIT
* @version 0.0.1
* @description A pure JavaScript ES6 promise polyfill.
* @see https://nuintun.github.io/promise
*/

(function () {
  'use strict';

  if (window.Promise) return;

  /**
   * @module native
   * @license MIT
   * @version 2017/12/05
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
   * @version 2017/12/05
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
   * @version 2017/12/05
   */

  var VBArray = window.VBArray;
  var MessageChannel = window.MessageChannel;

  var channel = {
    /**
     * @method support
     * @returns {boolean}
     */
    support: function() {
      // IE MessageChannel slower than script state change
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
   * @module script
   * @license MIT
   * @version 2017/12/05
   */

  var script = {
    /**
     * @method support
     * @returns {boolean}
     */
    support: function() {
      return 'onreadystatechange' in document.createElement('script');
    },

    /**
     * @method install
     * @param {Function} handler
     * @returns {Function}
     */
    install: function(handler) {
      return function() {
        var script = document.createElement('script');

        script.onreadystatechange = function() {
          handler();

          // Remove event
          script.onreadystatechange = null;

          // Remove script
          script.parentNode.removeChild(script);

          // Free script
          script = null;
        };

        document.documentElement.appendChild(script);
      };
    }
  };

  /**
   * @module timeout
   * @license MIT
   * @version 2017/12/05
   */

  var timeout = {
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
      return function() {
        setTimeout(handler, 0);
      };
    }
  };

  /**
   * @module task
   * @license MIT
   * @version 2017/12/05
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
   * @version 2017/12/05
   */

  var schedule;
  var queue = [];
  var draining = false;
  // Use chain: mutation > channel > script > timeout
  var schedules = [mutation, channel, script, timeout];

  /**
   * @function drain
   */
  function drain() {
    for (var i = 0; i < queue.length; i++) {
      queue[i].run();
    }

    queue = [];
    draining = false;
  }

  // Install schedule
  for (var i = 0, length = schedules.length; i < length; i++) {
    schedule = schedules[i];

    if (schedule.support()) {
      schedule = schedule.install(drain);

      break;
    }
  }

  /**
   * @function slice
   * @description Faster slice arguments
   * @param {Array|arguments} args
   * @param {number} start
   * @returns {Array}
   * @see https://github.com/teambition/then.js
   */
  function slice(args, start) {
    start = start >>> 0;

    var length = args.length;

    if (start >= length) {
      return [];
    }

    var rest = new Array(length - start);

    while (length-- > start) {
      rest[length - start] = args[length];
    }

    return rest;
  }

  /**
   * @function microtask
   * @param {Function} task
   */
  function microtask(task) {
    var args = slice(arguments, 1);

    // Equivalent to push, but avoids a function call. It's faster then push
    queue[queue.length] = new Task(task, args);

    if (!draining) {
      draining = true;

      schedule();
    }
  }

  /**
   * @module utils
   * @license MIT
   * @version 2017/12/05
   */

  /**
   * @function isFunction
   * @param {any} value
   * @returns {boolean}
   */
  function isFunction(value) {
    return typeof value === 'function';
  }

  var toString = Object.prototype.toString;

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

  var console = window.console;

  /**
   * @function printError
   */
  var printError = console && console.error ? console.error : function() {};

  /**
   * @module resolver
   * @license MIT
   * @version 2017/12/05
   */

  /**
   * @class Resolver
   * @constructor
   * @description
   *  Represents an asynchronous operation. Provides a
   *  standard API for subscribing to the moment that the operation completes either
   *  successfully (`fulfilled()`) or unsuccessfully (`reject()`).
   */
  function Resolver() {
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

  /**
   * @module promise
   * @license MIT
   * @version 2017/12/05
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
     * @property <resolver>
     * @description A reference to the resolver object that handles this promise
     */
    this['<resolver>'] = resolver;

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

  // Set name
  Promise.name = 'Promise';

  // Set prototype
  Promise.prototype = {
    /**
     * @property constructor
     */
    constructor: Promise,

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
      var resolver = this['<resolver>'];

      var promise = new Promise(function(_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
      });

      resolver.addCallbacks(
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
      return this.then(void 0, onRejected);
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

      var values = [];
      var length = iterable.length;

      if (length < 1) {
        return resolve(values);
      }

      var remaining = length;

      function oneResolve(index) {
        return function(value) {
          values[index] = value;

          if (--remaining === 0) {
            resolve(values);
          }
        };
      }

      for (var i = 0; i < length; i++) {
        Promise.resolve(iterable[i]).then(oneResolve(i), reject);
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
      for (var i = 0, length = iterable.length; i < length; i++) {
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
      var value;

      // Promises model exception handling through callbacks
      // making both synchronous and asynchronous errors behave
      // the same way
      try {
        // Use the argument coming in to the callback/errback from the
        // resolution of the parent promise.
        // The function must be called as a normal function, with no
        // special value for |this|, as per Promises A+
        value = callback(valueOrReason);
      } catch (error) {
        // Calling return only to stop here
        return reject(error);
      }

      if (value === promise) {
        return reject(new TypeError('Cannot resolve a promise with itself'));
      }

      resolve(value);
    };
  }

  // Exports to global
  window.Promise = Promise;

}());
