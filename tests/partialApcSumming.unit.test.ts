import { pickLowerQuality, sumDoorCounts } from "../src/partialApcSumming";

test("Pick the lower quality from two quality levels", () => {
  expect(pickLowerQuality("regular", "regular")).toBe("regular");
  expect(pickLowerQuality("regular", "defect")).toBe("defect");
  expect(pickLowerQuality("regular", "other")).toBe("other");
  expect(pickLowerQuality("regular", "foo")).toBe("other");
  expect(pickLowerQuality("defect", "regular")).toBe("defect");
  expect(pickLowerQuality("defect", "defect")).toBe("defect");
  expect(pickLowerQuality("defect", "other")).toBe("other");
  expect(pickLowerQuality("defect", "foo")).toBe("other");
  expect(pickLowerQuality("other", "regular")).toBe("other");
  expect(pickLowerQuality("other", "defect")).toBe("other");
  expect(pickLowerQuality("other", "other")).toBe("other");
  expect(pickLowerQuality("other", "foo")).toBe("other");
  expect(pickLowerQuality("foo", "regular")).toBe("other");
  expect(pickLowerQuality("foo", "defect")).toBe("other");
  expect(pickLowerQuality("foo", "other")).toBe("other");
  expect(pickLowerQuality("foo", "foo")).toBe("other");
});

describe("Sum door counts", () => {
  test("Add door counts for the same door and class", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "1", count: [{ class: "adult", in: 4, out: 1 }] },
    ];
    const expected = [
      { door: "1", count: [{ class: "adult", in: 5, out: 3 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("Add door counts only for a new class", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "1", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    const expected = [
      {
        door: "1",
        count: [
          { class: "adult", in: 1, out: 2 },
          { class: "child", in: 4, out: 1 },
        ],
      },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("Add door counts only for a new door", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "2", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    const expected = [
      { door: "1", count: [{ class: "adult", in: 1, out: 2 }] },
      { door: "2", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("Add door counts for an existing and a new door", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "1", count: [{ class: "adult", in: 1, out: 1 }] },
      { door: "2", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    const expected = [
      { door: "1", count: [{ class: "adult", in: 2, out: 3 }] },
      { door: "2", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("Add zero values", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "1", count: [{ class: "adult", in: 0, out: 0 }] },
      { door: "2", count: [{ class: "pram", in: 0, out: 0 }] },
    ];
    const expected = [
      { door: "1", count: [{ class: "adult", in: 1, out: 2 }] },
      { door: "2", count: [{ class: "pram", in: 0, out: 0 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("A complicated example", () => {
    const cached = [
      {
        door: "1",
        count: [
          { class: "adult", in: 1, out: 1 },
          { class: "child", in: 3, out: 1 },
        ],
      },
      { door: "2", count: [{ class: "adult", in: 1, out: 1 }] },
    ];
    const toBeAdded = [
      {
        door: "1",
        count: [
          { class: "child", in: 3, out: 1 },
          { class: "pram", in: 0, out: 0 },
        ],
      },
      { door: "2", count: [{ class: "child", in: 0, out: 2 }] },
      { door: "4", count: [{ class: "pram", in: 1, out: 0 }] },
    ];
    const expected = [
      {
        door: "1",
        count: [
          { class: "adult", in: 1, out: 1 },
          { class: "child", in: 6, out: 2 },
          { class: "pram", in: 0, out: 0 },
        ],
      },
      {
        door: "2",
        count: [
          { class: "adult", in: 1, out: 1 },
          { class: "child", in: 0, out: 2 },
        ],
      },
      { door: "4", count: [{ class: "pram", in: 1, out: 0 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });
});
