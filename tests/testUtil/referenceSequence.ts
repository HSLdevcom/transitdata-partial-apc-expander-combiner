import deepEqual from "../../src/util/deepEqual";

const hasConsecutiveRepetitions = <T>(array: T[]): boolean =>
  array.some(
    (item, index) =>
      index < array.length - 1 && deepEqual(item, array[index + 1]),
  );

/**
 * Creates a function that checks if a value is part of a reference sequence.
 *
 * The values passed to the returned function must follow the order of the
 * reference sequence. For example, if the reference sequence is `[1, 2, 3, 4]`,
 * the function will return `true` for `1`, then `true` for `2`, then `true` for
 * `3`, and so on. If the values are not in the correct order, the function will
 * return `false`.
 *
 * The values passed to the returned function may be repeated but the reference
 * sequence must not have identical values consecutively.
 *
 * Null and undefined values are okay.
 *
 * If the reference sequence is empty, the returned function always returns
 * `false`.
 *
 * The reference sequence can contain any type of values, including primitives,
 * objects, and arrays.
 */
const createReferenceSequenceChecker = <T>(
  referenceSequence: T[],
): ((value: T) => boolean) => {
  if (hasConsecutiveRepetitions(referenceSequence)) {
    throw new Error("Reference sequence cannot have repetitions");
  }

  let currentIndex = 0;

  const check = (value: T): boolean => {
    const valueExists = referenceSequence.some(
      (item, index) => index <= currentIndex && deepEqual(item, value),
    );
    if (
      currentIndex < referenceSequence.length &&
      deepEqual(referenceSequence[currentIndex], value)
    ) {
      currentIndex += 1;
    }
    return valueExists;
  };

  return check;
};

export default createReferenceSequenceChecker;
