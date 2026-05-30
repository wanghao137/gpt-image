#!/usr/bin/env node
/**
 * Generate a salted PBKDF2-SHA-256 hash for the admin password.
 *
 * Output format (matches src/admin/crypto.ts `verifyPassword`):
 *   pbkdf2$<iterations>$<saltBase64>$<hashBase64>
 *
 * Usage:
 *   node scripts/admin-hash.mjs           # prompts (hidden) for the password
 *   node scripts/admin-hash.mjs <pwd>     # one-shot
 *
 * Then put the value into your build environment:
 *   VITE_ADMIN_PASSWORD_HASH=pbkdf2$210000$...$...
 */

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";

// Keep in sync with src/admin/crypto.ts.
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEY_BYTES = 32; // 256 bits
const PBKDF2_DIGEST = "sha256";

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
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pwd, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES, PBKDF2_DIGEST);
  const value = `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
  console.log("");
  console.log("Add this to your build environment:");
  console.log("");
  console.log(`  VITE_ADMIN_PASSWORD_HASH=${value}`);
  console.log("");
  console.log("e.g. for local dev create .env.local with that line.");
}

main();
