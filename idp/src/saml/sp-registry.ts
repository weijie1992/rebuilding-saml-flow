// Registers trusted SPs from their metadata files into service_providers.
//
// In a real IdP an admin does this in a console ("Add application → upload
// metadata"). Here the IdP reads shared/metadata/sp-metadata.xml at startup.
// Only SPs in this table can get Assertions from the IdP (phase 4).

import { existsSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import { config } from "../config.ts";
import { audit } from "../db/audit.ts";
import { loadSpMetadataFile } from "./metadata.ts";

export async function registerServiceProviders(pool: pg.Pool): Promise<void> {
  const file = path.join(config.metadataDir, "sp-metadata.xml");

  if (!existsSync(file)) {
    console.warn(
      `idp: no SP metadata at ${file} — no apps registered. Run scripts/export-metadata.sh.`,
    );
    return;
  }

  let sp;
  try {
    sp = loadSpMetadataFile(file);
  } catch (err) {
    // Fail closed: an unreadable file registers nothing, but the IdP still
    // runs so you can fix the file and re-export.
    console.error(`idp: could not load ${file}:`, err);
    await audit(pool, "metadata.sp_rejected", { file, error: String(err) });
    return;
  }

  // Upsert: re-exporting the SP's metadata (e.g. its ACS URL changed)
  // updates the registration instead of failing on the primary key.
  await pool.query(
    `INSERT INTO service_providers (entity_id, acs_url, slo_url, name_id_format, display_name)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entity_id) DO UPDATE SET
       acs_url = EXCLUDED.acs_url,
       slo_url = EXCLUDED.slo_url,
       name_id_format = EXCLUDED.name_id_format,
       display_name = EXCLUDED.display_name`,
    [sp.entityId, sp.acsUrl, sp.sloUrl, sp.nameIdFormat, sp.displayName],
  );

  if (!sp.wantAssertionsSigned) {
    console.warn(`idp: SP ${sp.entityId} does not set WantAssertionsSigned="true"`);
  }
  await audit(pool, "metadata.sp_registered", { file, ...sp });
  console.log(`idp: registered SP ${sp.entityId} (ACS ${sp.acsUrl})`);
}
