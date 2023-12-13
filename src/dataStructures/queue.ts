import assert from "node:assert";

export interface Queue<T> {
  push: (item: T) => void;
  pop: () => Promise<T>;
  size: () => number;
  peek: () => T | undefined;
}

/**
 * Create a queue.
 *
 * The pop will be resolved even if the queue is empty when the pop is called.
 * Multiple pops will be resolved in order after multiple push calls.
 */
export const createQueue = <T>(): Queue<T> => {
  const items: T[] = [];
  const resolvers: ((value: T) => void)[] = [];

  const processQueue = (): void => {
    if (items.length > 0 && resolvers.length > 0) {
      const resolver = resolvers.shift();
      assert(
        resolver !== undefined,
        "Resolver must be defined as resolvers was not empty",
      );
      const item = items.shift();
      // Allow pushing and popping `undefined`. items must have returned an item
      // for pop as items was not empty.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      resolver(item!);
    }
  };

  const push = (item: T): void => {
    items.push(item);
    processQueue();
  };

  const pop = async (): Promise<T> => {
    if (items.length > 0) {
      const item = items.shift();
      // Allow pushing and popping `undefined`. items must have returned an item
      // for pop as items was not empty.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return item!;
    }
    return new Promise<T>((resolve) => {
      resolvers.push(resolve);
    });
  };

  const size = (): number => items.length;

  const peek = (): T | undefined => items[0];

  return { push, pop, size, peek };
};
