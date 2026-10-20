// Prints an argon2id hash for data/users.json. Reads the password from stdin so it never lands in shell history.
import { hash } from "argon2";
import { text } from "node:stream/consumers";

const password = (await text(process.stdin)).replace(/\r?\n$/, "");
if (!password) {
  process.stderr.write("usage: printf %s 'password' | npm run -s hash-password\n");
  process.exit(1);
}
process.stdout.write(`${await hash(password)}\n`);
