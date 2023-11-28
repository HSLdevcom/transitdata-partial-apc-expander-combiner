/**
 * Modified from
 * https://github.com/hwkd/docker-secret/tree/6fa920ac16d383b173db33ed04554754cf418aed
 * on 2023-11-28
 * under MIT license
 * https://github.com/hwkd/docker-secret/blob/6fa920ac16d383b173db33ed04554754cf418aed/LICENSE
 *
 * The purpose of copying this small module here is to reduce the attack surface
 * regarding supply chain attacks.
 */
import fs from "node:fs";
import path from "node:path";

// Default secrets directory.
const SECRET_DIR = "/run/secrets";

// Keep the type here instead of in types.ts to keep this module self-contained
// and a straightforward copy of the original.
export type Secrets = Record<string, string>;

export const getSecrets = <T extends Secrets = Secrets>(
  secretDir?: string,
): T => {
  const dir = secretDir ?? SECRET_DIR;

  const secrets: Secrets = {};
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const fullPath = path.join(dir, file);

      if (fs.lstatSync(fullPath).isDirectory()) {
        return;
      }

      secrets[file] = fs.readFileSync(fullPath, "utf8").trim();
    });
  }

  return secrets as T;
};
