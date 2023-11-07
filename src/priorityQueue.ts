import assert from "node:assert";
import { Heap } from "heap-js";

/**
 * The function comparable defines the priority order between two items in the
 * priority queue. Make the order total. If a should be popped first, then the
 * return value of comparable should be negative. If b first, positive. If a and
 * b have identical priority for your purposes, return zero.
 */
export interface PriorityQueueConfig<T> {
  comparable: (a: T, b: T) => number;
}

export interface PriorityQueue<T> {
  push: (item: T) => void;
  pop: () => Promise<T>;
  size: () => number;
  peek: () => T | undefined;
}

/**
 * Create a priority queue.
 *
 * The item of the lowest value as determined by the 'comparable' function is
 * returned when 'pop' is called.
 *
 * The pop will be resolved even if the heap is empty when the pop is called.
 * Multiple pops will be resolved in order after multiple push calls.
 */
export const createPriorityQueue = <T>({
  comparable,
}: PriorityQueueConfig<T>): PriorityQueue<T> => {
  const heap = new Heap<T>(comparable);
  const resolvers: ((value: T) => void)[] = [];
  /**
   * Separation of pushing to the queue and resolving the pops is done to allow
   * multiple pushing before resolving any of the waiting pops. Without this,
   * pushing to an empty queue will resolve a waiting pop without considering
   * the priorities of subsequent push actions.
   */
  let pendingResolverPromise: Promise<void> = Promise.resolve();

  const resolvePromises = (): void => {
    while (heap.size() > 0 && resolvers.length > 0) {
      const resolver = resolvers.shift();
      assert(
        resolver !== undefined,
        "Resolver must be defined as resolvers was not empty",
      );
      const item = heap.pop();
      // Allow pushing and popping `undefined`. heap must have returned an item
      // for pop as heap was not empty.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      resolver(item!);
    }
  };

  const push = (item: T): void => {
    heap.push(item);
    pendingResolverPromise = pendingResolverPromise.then(resolvePromises);
  };

  /**
   * If there are items in the queue, the one with the highest priority is
   * popped and returned. If the queue is empty, the popping will be kept
   * pending until new items are added.
   */
  const pop = async (): Promise<T> => {
    if (heap.size() > 0) {
      const item = heap.pop();
      // Allow pushing and popping `undefined`. heap must have returned an item
      // for pop as heap was not empty.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return item!;
    }
    return new Promise((resolver) => {
      resolvers.push(resolver);
    });
  };

  const size = (): number => heap.size();

  const peek = (): T | undefined => heap.peek();

  return { push, pop, size, peek };
};
