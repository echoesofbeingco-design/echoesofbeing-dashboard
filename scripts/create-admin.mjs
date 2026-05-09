#!/usr/bin/env node

/**
 * CLI: Create an admin user
 * Usage: node scripts/create-admin.mjs <username> <password> [role]
 *
 * Example:
 *   node scripts/create-admin.mjs admin mypassword123
 *   node scripts/create-admin.mjs viewer viewerpass viewer
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
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
    console.error("Could not read .env.local — make sure it exists in the project root.");
    process.exit(1);
  }
}

loadEnv();

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("\n  Usage: node scripts/create-admin.mjs <username> <password> [role]\n");
  console.log("  Roles: admin (default), viewer\n");
  console.log("  Example:");
  console.log("    node scripts/create-admin.mjs admin mypassword123");
  console.log("    node scripts/create-admin.mjs viewer viewerpass viewer\n");
  process.exit(1);
}

const [username, password, role = "admin"] = args;

if (!["admin", "viewer"].includes(role)) {
  console.error(`\n  Invalid role "${role}". Must be "admin" or "viewer".\n`);
  process.exit(1);
}

if (password.length < 8) {
  console.error("\n  Password must be at least 8 characters.\n");
  process.exit(1);
}

// Initialize Firebase Admin
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

async function createAdmin() {
  const docRef = db.collection("admin_users").doc(username.toLowerCase());
  const existing = await docRef.get();

  if (existing.exists) {
    console.error(`\n  User "${username}" already exists. Use reset-password to update.\n`);
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  await docRef.set({
    username: username.toLowerCase(),
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
  });

  console.log(`\n  Admin user created successfully!`);
  console.log(`  Username: ${username.toLowerCase()}`);
  console.log(`  Role: ${role}\n`);
}

createAdmin().catch((err) => {
  console.error("\n  Error creating admin:", err.message, "\n");
  process.exit(1);
});
