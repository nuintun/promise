/**
 * @module finally
 * @author nuintun
 * @license MIT
 */

export default function allSettled(promises) {
  Promise.all(
    promises.map(promise =>
      promise.then(value => ({ state: 'fulfilled', value })).catch(reason => ({ state: 'rejected', reason }))
    )
  );
}
