import { AbortError, createSleep } from "../../src/util/sleep";

describe("createSleep", () => {
  jest.useFakeTimers();

  test("sleep should resolve after the specified delay", () => {
    const { sleep } = createSleep();
    const promise = sleep(1_000);
    jest.advanceTimersByTime(1_000);
    return expect(promise).resolves.toEqual(undefined);
  });

  test("sleep should reject with AbortError if aborted before the specified delay", () => {
    const { sleep, abort } = createSleep();
    const promise = sleep(1_000);
    abort();
    jest.advanceTimersByTime(1_000);
    return expect(promise).rejects.toThrow(AbortError);
  });

  test("abort should have no effect if called after the delay has passed", () => {
    const { sleep, abort } = createSleep();
    const promise = sleep(1_000);
    jest.advanceTimersByTime(1_000);
    abort();
    return expect(promise).resolves.toBeUndefined();
  });

  test("abort can be called multiple times", () => {
    const { sleep, abort } = createSleep();
    const promise = sleep(1_000);
    abort();
    abort();
    jest.advanceTimersByTime(1_000);
    return expect(promise).rejects.toThrow(AbortError);
  });
});
