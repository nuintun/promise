/**
 * @module utils
 * @author nuintun
 * @license MIT
 */

/**
 * @function isFunction
 * @param {any} value
 * @returns {boolean}
 */
export function isFunction(value) {
  return typeof value === 'function';
}

var toString = Object.prototype.toString;

/**
 * @function isArray
 * @param {any} value
 * @returns {boolean}
 */
export var isArray = isFunction(Array.isArray)
  ? Array.isArray
  : function (value) {
      return toString.call(value) === '[object Array]';
    };

var console = this.console;

/**
 * @function printError
 */
export var printError = console && console.error ? console.error : function () {};
