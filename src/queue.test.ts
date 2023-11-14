import fc from "fast-check";
import { createQueue } from "./queue";

describe("unit testing for Queue", () => {
  test("should wait when popping an empty queue", async () => {
    const queue = createQueue<number>();
    const itemPromise = queue.pop();
    queue.push(5);
    expect(await itemPromise).toEqual(5);
  });

  test("should wait when popping an empty queue, with a timer", async () => {
    expect.assertions(1);
    jest.useFakeTimers();
    const queue = createQueue();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises,jest/valid-expect-in-promise
    queue.pop().then((item) => {
      expect(item).toEqual(5);
    });
    setTimeout(() => {
      queue.push(5);
    }, 1000);
    await jest.runAllTimersAsync();
  });

  test("should allow pushing and popping undefined", async () => {
    const queue = createQueue<number | undefined>();
    queue.push(undefined);
    expect(queue.size()).toBe(1);
    expect(queue.peek()).toBeUndefined();
    expect(await queue.pop()).toBeUndefined();
    expect(queue.size()).toBe(0);
    expect(queue.peek()).toBeUndefined();
  });
});

/* eslint-disable no-restricted-syntax,no-await-in-loop */
describe("property-based testing for Queue", () => {
  test("should correctly push item into the queue", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const queue = createQueue();
        queue.push(value);
        expect(queue.size()).toBe(1);
        expect(queue.peek()).toEqual(value);
      }),
    );
  });

  test("should correctly pop items in FIFO order", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.anything()), async (values) => {
        const queue = createQueue();
        values.forEach((value) => {
          queue.push(value);
        });
        for (const value of values) {
          expect(await queue.pop()).toEqual(value);
        }
      }),
    );
  });
});
/* eslint-enable no-restricted-syntax,no-await-in-loop */
