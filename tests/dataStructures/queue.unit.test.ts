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
    expect(queue.peekSync()).toBeUndefined();
    expect(await queue.pop()).toBeUndefined();
    expect(queue.size()).toBe(0);
    expect(queue.peekSync()).toBeUndefined();
  });

  describe("concurrent peek and pop operations", () => {
    test("peek should resolve correctly when followed by pop", async () => {
      expect.assertions(4);
      jest.useFakeTimers();
      const queue = createQueue();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises,jest/valid-expect-in-promise
      queue.peek().then((item) => {
        expect(item).toEqual(1);
        // By this time the pending pop has been resolved already.
        expect(queue.size()).toEqual(0);
      });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises,jest/valid-expect-in-promise
      queue.pop().then((item) => {
        expect(item).toEqual(1);
        expect(queue.size()).toEqual(0);
      });
      setTimeout(() => {
        queue.push(1);
      }, 1000);
      await jest.runAllTimersAsync();
    });

    test("multiple concurrent peeks should return the same result and not empty the queue", async () => {
      const queue = createQueue();
      queue.push(10);
      const peekPromise1 = queue.peek();
      const peekPromise2 = queue.peek();
      expect(await peekPromise1).toBe(10);
      expect(await peekPromise2).toBe(10);
      expect(queue.size()).toEqual(1);
      expect(await queue.pop()).toBe(10);
      expect(queue.size()).toEqual(0);
    });

    test("interleaved push, peek and pop operations", async () => {
      const queue = createQueue();
      expect(queue.size()).toBe(0);
      queue.push(5);
      expect(queue.size()).toBe(1);
      const peekVal1 = queue.peek();
      expect(queue.size()).toBe(1);
      queue.push(6);
      expect(queue.size()).toBe(2);
      const popVal1 = queue.pop();
      expect(queue.size()).toBe(1);
      queue.push(7);
      expect(queue.size()).toBe(2);
      const peekVal2 = queue.peek();
      expect(queue.size()).toBe(2);
      const popVal2 = queue.pop();
      expect(queue.size()).toBe(1);
      const peekVal3 = queue.peek();
      expect(queue.size()).toBe(1);
      expect(await peekVal1).toBe(5);
      expect(queue.size()).toBe(1);
      expect(await popVal1).toBe(5);
      expect(queue.size()).toBe(1);
      expect(await peekVal2).toBe(6);
      expect(queue.size()).toBe(1);
      expect(await popVal2).toBe(6);
      expect(queue.size()).toBe(1);
      expect(await peekVal3).toBe(7);
      expect(queue.size()).toBe(1);
    });
  });
});
