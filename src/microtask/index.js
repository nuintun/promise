/**
 * @module index
 * @author nuintun
 * @license MIT
 */

import Task from './task';
import script from './schedule/script';
import channel from './schedule/channel';
import timeout from './schedule/timeout';
import mutation from './schedule/mutation';

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
export default function microtask(task) {
  var args = slice(arguments, 1);

  // Equivalent to push, but avoids a function call. It's faster then push
  queue[queue.length] = new Task(task, args);

  if (!draining) {
    draining = true;

    schedule();
  }
}
