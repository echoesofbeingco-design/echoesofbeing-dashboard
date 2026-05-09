#!/usr/bin/env node

/**
 * CLI: List all admin users
 * Usage: node scripts/list-admins.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    console.error("Could not read .env.local");
    process.exit(1);
  }
}

loadEnv();

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      })
    : getApps()[0];

const db = getFirestore(app);

async function listAdmins() {
  const snapshot = await db.collection("admin_users").get();

  if (snapshot.empty) {
    console.log("\n  No admin users found. Create one with:");
    console.log("  node scripts/create-admin.mjs <username> <password>\n");
    return;
  }

  console.log("\n  Admin Users:");
  console.log("  " + "-".repeat(60));

  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(
      `  ${data.username.padEnd(20)} ${(data.role || "admin").padEnd(10)} Created: ${data.createdAt?.slice(0, 10) || "N/A"}${data.lastLogin ? `  Last login: ${data.lastLogin.slice(0, 10)}` : ""}`
    );
  }

  console.log("  " + "-".repeat(60));
  console.log(`  Total: ${snapshot.size}\n`);
}

listAdmins().catch((err) => {
  console.error("\n  Error:", err.message, "\n");
  process.exit(1);
});
