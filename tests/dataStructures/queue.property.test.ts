import fc from "fast-check";
import { createQueue } from "../../src/dataStructures/queue";

describe("property-based testing for Queue", () => {
  test("should correctly push item into the queue", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const queue = createQueue();
        queue.push(value);
        expect(queue.size()).toBe(1);
        expect(queue.peekSync()).toEqual(value);
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

  test("should see the same head element for concurrent peeks", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.anything(), { minLength: 1, maxLength: 100 }),
        fc.integer({ min: 1, max: 10 }),
        async (values, peekCount) => {
          const queue = createQueue();
          values.forEach((value) => {
            queue.push(value);
          });
          const peeks = Array.from({ length: peekCount }, () => queue.peek());
          const results = await Promise.all(peeks);
          expect(new Set(results).size).toBe(1);
          expect(results[0]).toEqual(values[0]);
          expect(queue.size()).toEqual(values.length);
        },
      ),
    );
  });

  describe("concurrent peek and pop operations", () => {
    test("should maintain integrity and sequence with peeks and pops after pushes", async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(fc.anything()), async (values) => {
          const queue = createQueue();
          values.forEach((value) => {
            queue.push(value);
          });
          // Has at most values.length pop operations.
          const operations = Array.from({ length: values.length }, () =>
            Math.random() < 0.5
              ? { op: "pop", p: queue.pop() }
              : { op: "peek", p: queue.peek() },
          );
          const results = await Promise.all(operations.map((elem) => elem.p));
          const expectedResults = operations.map((operation) =>
            operation.op === "peek" ? values[0] : values.shift(),
          );
          expect(results).toEqual(expectedResults);
        }),
      );
    });

    test("should maintain integrity and sequence with interleaved peeks, pops and pushes", async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(fc.anything()), async (values) => {
          const queue = createQueue();
          const results: { op: string; value: unknown }[] = [];
          let valueIndex = 0;
          let isValuesLeftToAdd = valueIndex < values.length;
          while (isValuesLeftToAdd) {
            if (Math.random() < 0.5) {
              const value = values[valueIndex];
              queue.push(value);
              valueIndex += 1;
              isValuesLeftToAdd = valueIndex < values.length;
            } else if (queue.size() > 0) {
              const operation =
                Math.random() < 0.5
                  ? // eslint-disable-next-line no-await-in-loop
                    { op: "pop", value: await queue.pop() }
                  : // eslint-disable-next-line no-await-in-loop
                    { op: "peek", value: await queue.peek() };
              results.push(operation);
            }
          }
          const expectedResults = results.map((operation) =>
            operation.op === "peek" ? values[0] : values.shift(),
          );
          expect(results.map((elem) => elem.value)).toEqual(expectedResults);
        }),
      );
    });
  });
});
