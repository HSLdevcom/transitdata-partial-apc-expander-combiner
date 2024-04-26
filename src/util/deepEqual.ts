import assert from "node:assert";

const deepEqual = <T>(x: T, y: T): boolean => {
  try {
    assert.deepStrictEqual(x, y);
    return true;
  } catch {
    return false;
  }
};

export default deepEqual;
