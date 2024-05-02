export interface Queue<T> {
  peek: () => Promise<T>;
  peekSync: () => T | undefined;
  pop: () => Promise<T>;
  popSync: () => T | undefined;
  push: (item: T) => void;
  size: () => number;
}

interface Resolver<T> {
  type: "pop" | "peek";
  resolve: (value: T) => void;
}

/**
 * Create a queue.
 *
 * The pop or peek will be resolved even if the queue is empty when the pop or
 * peek is called. Multiple pops or peeks will be resolved in order after
 * multiple push calls.
 */
export const createQueue = <T>(): Queue<T> => {
  const items: T[] = [];
  const resolvers: Resolver<T>[] = [];

  const processQueue = (): void => {
    while (items.length > 0 && resolvers.length > 0) {
      // resolvers is not empty.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { type, resolve } = resolvers.shift()!;
      // items is not empty.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const item = items[0]!;
      if (type === "pop") {
        items.shift();
      }
      resolve(item);
    }
  };

  const peek = async (): Promise<T> => {
    if (items.length > 0) {
      // items is not empty.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return items[0]!;
    }
    return new Promise<T>((resolve) => {
      resolvers.push({ type: "peek", resolve });
    });
  };

  const peekSync = (): T | undefined => items[0];

  const pop = async (): Promise<T> => {
    if (items.length > 0) {
      // items is not empty.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const item = items.shift()!;
      return item;
    }
    return new Promise<T>((resolve) => {
      resolvers.push({ type: "pop", resolve });
    });
  };

  const popSync = (): T | undefined => items.shift();

  const push = (item: T): void => {
    items.push(item);
    processQueue();
  };

  /**
   * Size corresponds to the number of unpopped elements still in the queue.
   */
  const size = (): number => items.length;

  return { peek, peekSync, pop, popSync, push, size };
};
