import fc from "fast-check";
import { createQueue } from "../../src/dataStructures/queue";

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
        // eslint-disable-next-line no-restricted-syntax
        for (const value of values) {
          // eslint-disable-next-line no-await-in-loop
          expect(await queue.pop()).toEqual(value);
        }
      }),
    );
  });
});
