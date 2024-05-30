import createReferenceSequenceChecker from "./referenceSequence";

describe("createReferenceSequenceChecker", () => {
  it("returns a function that checks if a value is part of a reference sequence", () => {
    const referenceSequence = [1, 2, 3, 4];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check(1)).toBeTruthy();
    expect(check(2)).toBeTruthy();
    expect(check(3)).toBeTruthy();
    expect(check(4)).toBeTruthy();
    expect(check(5)).toBeFalsy();
  });

  it("returns true if a valid checked value is repeated", () => {
    const referenceSequence = [1, 2, 3, 1, 2];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check(1)).toBeTruthy();
    expect(check(2)).toBeTruthy();
    expect(check(2)).toBeTruthy();
    expect(check(3)).toBeTruthy();
    expect(check(1)).toBeTruthy();
    expect(check(1)).toBeTruthy();
    expect(check(1)).toBeTruthy();
    expect(check(2)).toBeTruthy();
    expect(check(4)).toBeFalsy();
  });

  it("handles null values in the reference sequence", () => {
    const referenceSequence = [1, null, 2, null];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check(1)).toBeTruthy();
    expect(check(null)).toBeTruthy();
    expect(check(2)).toBeTruthy();
    expect(check(null)).toBeTruthy();
    expect(check(3)).toBeFalsy();
  });

  it("handles undefined values in the reference sequence", () => {
    const referenceSequence = [1, undefined, 2, undefined];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check(1)).toBeTruthy();
    expect(check(undefined)).toBeTruthy();
    expect(check(2)).toBeTruthy();
    expect(check(undefined)).toBeTruthy();
    expect(check(3)).toBeFalsy();
  });

  it("returns false if the value is not part of the reference sequence", () => {
    const referenceSequence = [1, 2, 3, 4];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check(5)).toBeFalsy();
  });

  it("returns false for out-of-order values but afterwards returns true when the right value is given", () => {
    const referenceSequence = [1, 2, 3, 4];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check(1)).toBeTruthy();
    expect(check(3)).toBeFalsy();
    expect(check(2)).toBeTruthy();
    expect(check(4)).toBeFalsy();
    expect(check(3)).toBeTruthy();
    expect(check(4)).toBeTruthy();
  });

  it("returns true for a single-element reference sequence", () => {
    const referenceSequence = [1];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check(1)).toBeTruthy();
    expect(check(2)).toBeFalsy();
  });

  it("returns false if the reference sequence is empty", () => {
    const referenceSequence: number[] = [];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check(1)).toBeFalsy();
  });

  it("handles letters in the reference sequence", () => {
    const referenceSequence = ["a", "b", "c", "d"];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check("a")).toBeTruthy();
    expect(check("b")).toBeTruthy();
    expect(check("c")).toBeTruthy();
    expect(check("d")).toBeTruthy();
    expect(check("e")).toBeFalsy();
  });

  it("handles objects in the reference sequence", () => {
    const referenceSequence = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const check = createReferenceSequenceChecker(referenceSequence);
    expect(check({ id: 1 })).toBeTruthy();
    expect(check({ id: 2 })).toBeTruthy();
    expect(check({ id: 3 })).toBeTruthy();
    expect(check({ id: 4 })).toBeTruthy();
    expect(check({ id: 5 })).toBeFalsy();
  });

  it("throws an error if the reference sequence has consecutive repetitions", () => {
    expect(() => createReferenceSequenceChecker([1, 2, 2, 3])).toThrow(
      "Reference sequence cannot have repetitions",
    );
  });

  it("does not throw an error if the reference sequence has non-consecutive repetitions", () => {
    expect(() => createReferenceSequenceChecker([1, 2, 3, 2, 4])).not.toThrow();
  });
});
