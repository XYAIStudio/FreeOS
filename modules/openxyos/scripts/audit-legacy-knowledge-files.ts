/**
 * Read-only inventory for knowledge files created before tenant-scoped storage.
 * It deliberately does not move, delete, or rewrite any customer data.
 */
import path from "node:path";
import { initDatabase, dbAll } from "../backend/db";
import { UPLOAD_DIR } from "../backend/middleware/upload";

async function main() {
  await initDatabase({ readOnly: true });
  const rows = dbAll("SELECT id, tenant_id, file_path, original_name, created_at FROM knowledge_files ORDER BY tenant_id, id") as Array<Record<string, unknown>>;
  const legacy = rows.filter((row) => {
    const tenantRoot = path.resolve(UPLOAD_DIR, "tenants", String(row.tenant_id)) + path.sep;
    const filePath = typeof row.file_path === "string" ? path.resolve(row.file_path) : "";
    return !filePath.startsWith(tenantRoot);
  });

  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    upload_root: UPLOAD_DIR,
    total_knowledge_files: rows.length,
    tenant_scoped_files: rows.length - legacy.length,
    legacy_or_invalid_files: legacy.length,
    files: legacy,
    next_step: "Review this inventory, back up the file store and database, then run a separately approved migration plan. This command made no changes.",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
