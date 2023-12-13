import { createPriorityQueue } from "../../src/dataStructures/priorityQueue";

const compareNumbers = (a: number, b: number): number => a - b;

const compareNameValueObjects = (
  a: { value: number; name: string },
  b: { value: number; name: string },
): number => {
  if (a.value !== b.value) {
    return a.value - b.value;
  }
  if (a.name < b.name) {
    return -1;
  }
  if (a.name > b.name) {
    return 1;
  }
  return 0;
};

const compareNumbersOrUndefineds = (
  a: number | undefined,
  b: number | undefined,
) => {
  if (a === undefined) {
    if (b === undefined) {
      return 0;
    }
    return 1;
  }
  if (b === undefined) {
    return -1;
  }
  return a - b;
};

describe("unit testing for PriorityQueue", () => {
  test("should wait when popping an empty queue", async () => {
    const queue = createPriorityQueue<number>({
      comparable: compareNumbers,
    });
    const itemPromise = queue.pop();
    queue.push(5);
    expect(await itemPromise).toEqual(5);
  });

  test("should wait when popping an empty queue, with a timer", async () => {
    expect.assertions(1);
    jest.useFakeTimers();
    const queue = createPriorityQueue<number>({
      comparable: compareNumbers,
    });
    // eslint-disable-next-line @typescript-eslint/no-floating-promises,jest/valid-expect-in-promise
    queue.pop().then((item) => {
      expect(item).toEqual(5);
    });
    setTimeout(() => {
      queue.push(5);
    }, 1000);
    await jest.runAllTimersAsync();
  });

  test("should handle multiple pop calls on an empty queue", async () => {
    const queue = createPriorityQueue<number>({
      comparable: compareNumbers,
    });
    const popPromises = [queue.pop(), queue.pop(), queue.pop()];
    queue.push(5);
    queue.push(2);
    queue.push(4);
    const values = await Promise.all(popPromises);
    expect(values).toEqual([2, 4, 5]);
  });

  test("should handle simultaneous push and pop operations", async () => {
    jest.useFakeTimers();
    const shuffleArray = <T>(array: T[]): T[] =>
      array
        .map((a) => ({ sort: Math.random(), value: a }))
        .sort((a, b) => a.sort - b.sort)
        .map((a) => a.value);
    const queue = createPriorityQueue<number>({ comparable: compareNumbers });
    const popPromises = Array.from({ length: 10 }).map(() => queue.pop());
    const shuffledIndices = shuffleArray(
      Array.from({ length: 10 }, (_, i) => i),
    );
    const pushPromises = shuffledIndices.map(
      (i) =>
        new Promise((resolve) =>
          // eslint-disable-next-line no-promise-executor-return
          setTimeout(() => {
            queue.push(i);
            resolve(null);
          }, 100 * i),
        ),
    );
    jest.runOnlyPendingTimers();
    await Promise.all(pushPromises);
    const popResults = await Promise.all(popPromises);
    expect(popResults).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("should handle popping and refilling an empty queue repeatedly", async () => {
    const queue = createPriorityQueue<number>({
      comparable: compareNumbers,
    });
    const pushToQueue = (sequence: number[]) => {
      sequence.forEach((value) => {
        queue.push(value);
      });
      return sequence.map(() => queue.pop());
    };
    const sequenceOne = [5, 1, 3];
    const sequenceTwo = [8, 4, 6, 9, 2];

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    queue.pop();

    let popPromises = pushToQueue(sequenceOne);
    let results = await Promise.all(popPromises);
    expect(results).toEqual(sequenceOne.sort(compareNumbers));

    popPromises = pushToQueue(sequenceTwo);
    queue.push(7);
    results = await Promise.all(popPromises);
    expect(results).toEqual(sequenceTwo.sort(compareNumbers));

    const finalPopPromise = queue.pop();
    queue.push(10);
    expect(await finalPopPromise).toEqual(10);
  });

  test("should allow pushing and popping undefined", async () => {
    const queue = createPriorityQueue<number | undefined>({
      comparable: compareNumbersOrUndefineds,
    });
    queue.push(undefined);
    expect(queue.size()).toBe(1);
    expect(queue.peek()).toBeUndefined();
    expect(await queue.pop()).toBeUndefined();
    expect(queue.size()).toBe(0);
    expect(queue.peek()).toBeUndefined();
  });

  test("a usage example", async () => {
    jest.useFakeTimers();

    const queue = createPriorityQueue<{ value: number; name: string }>({
      comparable: compareNameValueObjects,
    });
    expect(queue.size()).toEqual(0);

    const popPromise = queue.pop();
    setTimeout(() => {
      queue.push({ value: 5, name: "foo" });
    }, 1000);
    await jest.runAllTimersAsync();
    expect(queue.size()).toEqual(0);

    queue.push({ value: 10, name: "bar" });
    expect(queue.peek()).toEqual({ value: 10, name: "bar" });
    expect(queue.size()).toEqual(1);

    const item = await popPromise;
    expect(item).toEqual({ value: 5, name: "foo" });

    expect(await queue.pop()).toEqual({ value: 10, name: "bar" });
  });
});
