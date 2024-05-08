/**
 * splitArray, given a predicate p and an array arr, returns an object where the
 * property "start" is the longest prefix (possibly empty) of arr of elements
 * that satisfy p and where the property "end" is the remainder of arr.
 *
 * Inspired by span from Data.List in Haskell.
 */
const splitArray = <T>(
  predicate: (value: T) => boolean,
  array: T[],
): { start: T[]; end: T[] } => {
  const idx = array.findIndex((value) => !predicate(value));
  return idx === -1
    ? { start: array, end: [] }
    : { start: array.slice(0, idx), end: array.slice(idx) };
};

export default splitArray;
