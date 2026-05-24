import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const projects = await db.project.findMany({
    where: { id: { startsWith: "bc-" } },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          members: true,
          phases: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Count bc-prefixed tasks, pings, files per project
  console.log(`\n${projects.length} imported projects found:\n`);
  for (const p of projects) {
    const bcId = p.id.replace("bc-", "");
    const [taskCount, pingCount, fileCount, folderCount] = await Promise.all([
      db.task.count({ where: { projectId: p.id, id: { startsWith: "bc-todo-" } } }),
      db.ping.count({ where: { projectId: p.id, id: { startsWith: "bc-msg-" } } }),
      db.projectFile.count({ where: { projectId: p.id, id: { startsWith: "bc-upload-" } } }),
      db.docFolder.count({ where: { projectId: p.id, id: { startsWith: "bc-vault-" } } }),
    ]);
    console.log(`  ${p.name}`);
    console.log(`    BC id: ${bcId} | Core id: ${p.id} | Status: ${p.status}`);
    console.log(`    tasks: ${taskCount}  discussions: ${pingCount}  files: ${fileCount}  folders: ${folderCount}  members: ${p._count.members}`);
    console.log(`    Imported: ${p.createdAt.toLocaleDateString()} ${p.createdAt.toLocaleTimeString()}`);
    console.log();
  }

  await pool.end();
}

main().catch(console.error);
