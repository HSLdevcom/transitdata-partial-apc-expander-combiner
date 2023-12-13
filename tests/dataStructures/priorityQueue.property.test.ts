import fc from "fast-check";
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
