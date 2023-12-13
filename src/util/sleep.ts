/**
 * Unfortunately jest cannot currently handle mocking setTimeout from
 * "node:timers/promises", see issue
 * https://github.com/sinonjs/fake-timers/issues/469
 * We do not wish to mix callbacks and async functions. To keep our code
 * testable with jest, let's create our own cancellable wrapper around the
 * callback-based setTimeout.
 */

export class AbortError extends Error {
  constructor(message = "The operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}

export const createSleep = () => {
  let timeoutId: NodeJS.Timeout | undefined;
  let abortFunction: (() => void) | undefined;

  const sleep = (delay: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      abortFunction = () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        reject(new AbortError());
      };

      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        resolve();
        abortFunction = undefined;
      }, delay);
    });
  };

  const abort = () => {
    if (abortFunction !== undefined) {
      abortFunction();
    }
  };

  return { sleep, abort };
};
