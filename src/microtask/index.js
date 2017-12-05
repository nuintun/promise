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
var slice = Array.prototype.slice;
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
 * @function microtask
 * @param {Function} task
 */
export default function microtask(task) {
  var args = slice.call(arguments, 1);

  queue.push(new Task(task, args));

  schedule();
}
