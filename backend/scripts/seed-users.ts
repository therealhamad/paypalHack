import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const db = new PrismaClient();

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}

const DEMO_PASSWORD = "demo1234";

const demoUsers = [
  { email: "alex@raisinpay.demo", name: "Alex Rivera", companyName: "Raisin Demo Co", role: "PREPARER" as const },
  { email: "dana@raisinpay.demo", name: "Dana Chen", companyName: "Raisin Demo Co", role: "APPROVER" as const },
];

async function main() {
  for (const user of demoUsers) {
    await db.user.upsert({
      where: { email: user.email },
      update: { role: user.role, name: user.name, companyName: user.companyName },
      create: { ...user, passwordHash: await hashPassword(DEMO_PASSWORD) },
    });
    console.log(`seeded ${user.email} (${user.role})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
