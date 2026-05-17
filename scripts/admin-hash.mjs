#!/usr/bin/env node
/**
 * Generate a SHA-256 hash for the admin password.
 *
 * Usage:
 *   node scripts/admin-hash.mjs           # prompts (hidden) for the password
 *   node scripts/admin-hash.mjs <pwd>     # one-shot
 *
 * Then put the hex digest into your build environment:
 *   VITE_ADMIN_PASSWORD_HASH=<digest>
 */

import { createHash } from "node:crypto";
import { stdin, stdout } from "node:process";

async function readHidden(prompt) {
  return new Promise((resolve) => {
    stdout.write(prompt);
    let buffer = "";

    const onData = (chunk) => {
      const str = chunk.toString();
      for (const ch of str) {
        if (ch === "\n" || ch === "\r" || ch === "\u0004") {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          resolve(buffer);
          return;
        }
        if (ch === "\u0003") {
          // Ctrl-C
          stdin.setRawMode(false);
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        buffer += ch;
        stdout.write("*");
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main() {
  let pwd = process.argv[2];
  if (!pwd) {
    pwd = await readHidden("Admin password: ");
  }
  if (!pwd) {
    console.error("password is empty, aborting.");
    process.exit(1);
  }
  const digest = createHash("sha256").update(pwd, "utf8").digest("hex");
  console.log("");
  console.log("Add this to your build environment:");
  console.log("");
  console.log(`  VITE_ADMIN_PASSWORD_HASH=${digest}`);
  console.log("");
  console.log("e.g. for local dev create .env.local with that line.");
}

main();
