import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSecrets } from "../../src/util/dockerSecret";

describe("getSecrets", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docker-secret-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("should return an empty object when the secrets directory does not exist", () => {
    const nonExistentDir = path.join(tmpDir, "nonexistent");
    expect(getSecrets(nonExistentDir)).toStrictEqual({});
  });

  it("should return secrets from files in the directory, trimming whitespace", () => {
    fs.writeFileSync(path.join(tmpDir, "MY_SECRET"), "  my-value  ");
    fs.writeFileSync(path.join(tmpDir, "ANOTHER_SECRET"), "another-value\n");
    expect(getSecrets(tmpDir)).toStrictEqual({
      MY_SECRET: "my-value",
      ANOTHER_SECRET: "another-value",
    });
  });

  it("should skip subdirectories", () => {
    fs.mkdirSync(path.join(tmpDir, "subdir"));
    fs.writeFileSync(path.join(tmpDir, "MY_SECRET"), "my-value");
    expect(getSecrets(tmpDir)).toStrictEqual({ MY_SECRET: "my-value" });
  });
});
