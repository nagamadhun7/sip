export function createWriteQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = tail.catch(() => {}).then(work);
    tail = next;
    return next;
  };
}
