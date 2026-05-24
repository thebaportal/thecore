import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const testEmails = ["iamomojo@gmail.com", "1stfishseller@gmail.com"];

  const testUsers = await db.user.findMany({
    where: { email: { in: testEmails } },
    select: { id: true, email: true, name: true },
  });

  const ghostUsers = await db.user.findMany({
    where: { email: { endsWith: "@basecamp.import" } },
    select: { id: true, email: true, name: true },
  });

  const allToDelete = [...testUsers, ...ghostUsers];

  console.log("Deleting:");
  for (const u of allToDelete) console.log(`  - ${u.name} | ${u.email}`);

  if (allToDelete.length === 0) {
    console.log("Nothing to delete.");
    await pool.end();
    return;
  }

  const ids = allToDelete.map((u) => u.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");

  // Use raw SQL to handle all FK constraints cleanly
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`UPDATE "BasecampPerson" SET "coreUserId" = NULL WHERE "coreUserId" IN (${placeholders})`, ids);
    await client.query(`DELETE FROM "Notification" WHERE "userId" IN (${placeholders})`, ids);
    await client.query(`DELETE FROM "Reaction" WHERE "userId" IN (${placeholders})`, ids);
    await client.query(`DELETE FROM "TaskComment" WHERE "authorId" IN (${placeholders})`, ids);
    await client.query(`DELETE FROM "PingParticipant" WHERE "userId" IN (${placeholders})`, ids);

    // Messages: non-nullable authorId, must delete. Clear thread refs first.
    const msgRes = await client.query(`SELECT id FROM "Message" WHERE "authorId" IN (${placeholders})`, ids);
    const msgIds: string[] = msgRes.rows.map((r: { id: string }) => r.id);
    if (msgIds.length > 0) {
      const mp = msgIds.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(`DELETE FROM "Reaction" WHERE "messageId" IN (${mp})`, msgIds);
      await client.query(`DELETE FROM "Attachment" WHERE "messageId" IN (${mp})`, msgIds);
      await client.query(`UPDATE "Message" SET "threadParentId" = NULL WHERE "threadParentId" IN (${mp})`, msgIds);
      await client.query(`DELETE FROM "Message" WHERE id IN (${mp})`, msgIds);
    }

    // Projects/Tasks: non-nullable creatorId — transfer to the admin
    const adminRes = await client.query(`SELECT id FROM "User" WHERE email = 'omojo.amanyi@gmail.com' LIMIT 1`);
    const adminId: string | null = adminRes.rows[0]?.id ?? null;
    // Placeholders offset by 1 since adminId is $1
    const shiftedPh = ids.map((_, i) => `$${i + 2}`).join(", ");
    if (adminId) {
      await client.query(`UPDATE "Project" SET "creatorId" = $1 WHERE "creatorId" IN (${shiftedPh})`, [adminId, ...ids]);
      await client.query(`UPDATE "Task" SET "creatorId" = $1 WHERE "creatorId" IN (${shiftedPh})`, [adminId, ...ids]);
    } else {
      await client.query(`DELETE FROM "Task" WHERE "creatorId" IN (${placeholders})`, ids);
    }

    // Null out nullable FK fields on remaining content
    await client.query(`UPDATE "Task" SET "assigneeId" = NULL WHERE "assigneeId" IN (${placeholders})`, ids);
    await client.query(`UPDATE "ProjectPost" SET "authorId" = NULL WHERE "authorId" IN (${placeholders})`, ids);
    await client.query(`UPDATE "Doc" SET "authorId" = NULL WHERE "authorId" IN (${placeholders})`, ids);
    await client.query(`UPDATE "ProjectFile" SET "uploadedById" = NULL WHERE "uploadedById" IN (${placeholders})`, ids);
    await client.query(`UPDATE "PhaseDeliverable" SET "submittedById" = NULL WHERE "submittedById" IN (${placeholders})`, ids);
    await client.query(`UPDATE "PhaseDeliverable" SET "reviewedById" = NULL WHERE "reviewedById" IN (${placeholders})`, ids);
    await client.query(`UPDATE "DeliverableVersion" SET "uploadedById" = NULL WHERE "uploadedById" IN (${placeholders})`, ids);

    await client.query(`DELETE FROM "ProjectMember" WHERE "userId" IN (${placeholders})`, ids);
    await client.query(`DELETE FROM "OrgMembership" WHERE "userId" IN (${placeholders})`, ids);
    await client.query(`DELETE FROM "User" WHERE id IN (${placeholders})`, ids);

    await client.query("COMMIT");
    console.log(`\nDeleted ${ids.length} users.`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
