/**
 * A simple promise-based mutex for serializing async operations.
 * Ensures that only one holder executes at a time within a single process.
 *
 * Usage:
 *   const release = await mutex.acquire();
 *   try { ... } finally { release(); }
 */
export class Mutex {
  private queue: (() => void)[] = [];
  private locked = false;

  /**
   * Acquires the mutex lock.
   * If the mutex is already held, the caller waits until it is released.
   *
   * @returns A release function that must be called when the protected
   *          operation is complete. Failing to call it will deadlock
   *          subsequent acquirers.
   */
  async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        resolve(() => this.release());
      });
    });
  }

  /**
   * Releases the mutex and hands it to the next waiter, if any.
   */
  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}
