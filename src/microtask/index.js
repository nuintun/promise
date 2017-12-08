/**
 * @module index
 * @license MIT
 * @version 2017/12/05
 */

import mutation from './schedule/mutation';
import channel from './schedule/channel';
import script from './schedule/script';
import timeout from './schedule/timeout';
import Task from './task';

var schedule;
var queue = [];
// Use chain: mutation > channel > script > timeout
var schedules = [mutation, channel, script, timeout];

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

  schedule();
}
