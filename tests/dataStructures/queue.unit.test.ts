import { createQueue } from "../../src/dataStructures/queue";

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
