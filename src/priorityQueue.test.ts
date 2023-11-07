import fc from "fast-check";
import { createPriorityQueue } from "./priorityQueue";

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

/* eslint-disable no-restricted-syntax,no-await-in-loop */
describe("property-based testing for PriorityQueue", () => {
  test("should correctly push item into the queue", () => {
    fc.assert(
      fc.property(fc.integer(), (value) => {
        const queue = createPriorityQueue<number>({
          comparable: compareNumbers,
        });
        queue.push(value);
        expect(queue.size()).toBe(1);
        expect(queue.peek()).toEqual(value);
      }),
    );
  });

  test("should correctly pop item according to the lowest priority", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer()), async (values) => {
        const queue = createPriorityQueue<number>({
          comparable: compareNumbers,
        });
        const sorted = [...values].sort(compareNumbers);
        values.forEach((value) => {
          queue.push(value);
        });
        for (const value of sorted) {
          expect(await queue.pop()).toEqual(value);
        }
      }),
    );
  });

  test("should handle pop request even before any elements have been pushed into the queue", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer(), async (value) => {
        const queue = createPriorityQueue<number>({
          comparable: compareNumbers,
        });
        const itemPromise = queue.pop();
        queue.push(value);
        expect(await itemPromise).toEqual(value);
      }),
    );
  });

  test("should correctly push and pop different types of objects", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ value: fc.integer(), name: fc.string() }),
        async (obj) => {
          const queue = createPriorityQueue<{ value: number; name: string }>({
            comparable: compareNameValueObjects,
          });
          queue.push(obj);
          expect(await queue.pop()).toEqual(obj);
        },
      ),
    );
  });

  test("should always pop items in the order of their priority", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ value: fc.integer(), name: fc.string() })),
        async (objs) => {
          const queue = createPriorityQueue<{ value: number; name: string }>({
            comparable: compareNameValueObjects,
          });
          const sortedObjs = [...objs].sort(compareNameValueObjects);
          objs.forEach((obj) => {
            queue.push(obj);
          });
          for (const obj of sortedObjs) {
            expect(await queue.pop()).toEqual(obj);
          }
        },
      ),
    );
  });

  test("should handle multiple push operations and maintain the correct popping order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ value: fc.integer(), name: fc.string() }), {
          maxLength: 100,
        }),
        async (objs) => {
          const queue = createPriorityQueue<{ value: number; name: string }>({
            comparable: compareNameValueObjects,
          });
          const sortedObjs = [...objs].sort(compareNameValueObjects);
          objs.forEach((obj) => {
            queue.push(obj);
          });
          for (const obj of sortedObjs) {
            expect(await queue.pop()).toEqual(obj);
          }
        },
      ),
    );
  });

  test("should handle multiple pop requests initiated before pushing any values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer(), { minLength: 1 }),
        async (values) => {
          const queue = createPriorityQueue<number>({
            comparable: compareNumbers,
          });
          const sortedValues = values.slice().sort(compareNumbers);
          const popPromises = sortedValues.map(() => queue.pop());
          values.forEach((value) => {
            queue.push(value);
          });
          const results = await Promise.all(popPromises);
          expect(results).toEqual(sortedValues);
        },
      ),
    );
  });
});
/* eslint-enable no-restricted-syntax,no-await-in-loop */
