/**
 * @module index
 * @license MIT
 * @version 2017/12/04
 */

import mutation from './schedule/mutation';
import channel from './schedule/channel';
import image from './schedule/image';
import Task from './task';

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
export default function microtask(task) {
  var args = slice.call(arguments, 1);

  queue.push(new Task(task, args));

  schedule();
}
