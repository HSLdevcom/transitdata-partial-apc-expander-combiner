import splitArray from "../../src/util/splitArray";

describe("splitArray", () => {
  it("should return entire array as start and empty array as end when all elements match the predicate", () => {
    const array = [1, 2, 3, 4, 5, 1];
    const predicate = (x: number): boolean => x > 0;
    const { start, end } = splitArray(predicate, array);
    expect(start).toStrictEqual(array);
    expect(end).toStrictEqual([]);
  });

  it("should return empty array as start and entire array as end when no elements match the predicate", () => {
    const array = [1, 2, 3, 4, 5, 1];
    const predicate = (x: number): boolean => x < 0;
    const { start, end } = splitArray(predicate, array);
    expect(start).toStrictEqual([]);
    expect(end).toStrictEqual(array);
  });

  it("should split array at first element that does not match the predicate", () => {
    const array = [1, 2, 3, 4, 5, 1];
    const predicate = (x: number): boolean => x < 4;
    const { start, end } = splitArray(predicate, array);
    expect(start).toStrictEqual([1, 2, 3]);
    expect(end).toStrictEqual([4, 5, 1]);
  });

  it("should handle empty array", () => {
    const array: number[] = [];
    const predicate = (x: number): boolean => x > 0;
    const { start, end } = splitArray(predicate, array);
    expect(start).toStrictEqual([]);
    expect(end).toStrictEqual([]);
  });
});
