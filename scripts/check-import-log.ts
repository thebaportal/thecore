import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  // Check files currently in the library (projectId=null) that came from Basecamp
  const libraryFiles = await db.projectFile.count({
    where: { projectId: null, id: { startsWith: "bc-upload-" } },
  });
  const libraryDocs = await db.doc.count({
    where: { projectId: null, id: { startsWith: "bc-doc-" } },
  });
  console.log(`Library (projectId=null): ${libraryFiles} bc-files, ${libraryDocs} bc-docs`);

  // Check what's still in the two BA projects
  for (const id of ["bc-15579599", "bc-15361429"]) {
    const proj = await db.project.findUnique({ where: { id }, select: { name: true } });
    const files = await db.projectFile.count({ where: { projectId: id } });
    const docs = await db.doc.count({ where: { projectId: id } });
    const folders = await db.docFolder.count({ where: { projectId: id } });
    console.log(`${proj?.name}: ${files} files, ${docs} docs, ${folders} folders`);
  }

  // Check import logs
  for (const id of ["bc-15579599", "bc-15361429"]) {
    const log = await db.basecampImportLog.findUnique({ where: { projectId: id } });
    const proj = await db.project.findUnique({ where: { id }, select: { name: true } });
    console.log(`\nImport log for ${proj?.name}: status=${log?.status} filesCount=${log?.filesCount} foldersCount=${log?.foldersCount} failed=${log?.failedFilesCount}`);
    const phases = (log?.phaseErrors as any[]) ?? [];
    if (phases.length) console.log("  Phase errors:", JSON.stringify(phases));
  }

  await pool.end();
}

main().catch(console.error);
