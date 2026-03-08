#!/usr/bin/env node
/**
 * Report Upload Script
 *
 * Reads the generated report.json and profile.json, then uploads them
 * to the Cloudflare Worker API with a unique secret code for access.
 *
 * Usage:
 *   UPLOAD_SECRET=xxx node src/upload.js <username>
 *
 * Environment variables:
 *   WORKER_URL     - Worker base URL (default: https://insta-analyzer-worker.taiichifox.workers.dev)
 *   UPLOAD_SECRET  - Required bearer token for the upload endpoint
 */

import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const WORKER_URL =
  process.env.WORKER_URL ||
  "https://insta-analyzer-worker.taiichifox.workers.dev";

const UPLOAD_SECRET = process.env.UPLOAD_SECRET;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSON file, returning null if not found.
 */
async function readJSON(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // --- Validate CLI args ---
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: node src/upload.js <username>");
    process.exit(1);
  }

  // --- Validate env ---
  if (!UPLOAD_SECRET) {
    console.error("Error: UPLOAD_SECRET environment variable is required.");
    console.error("Set it before running: UPLOAD_SECRET=xxx node src/upload.js <username>");
    process.exit(1);
  }

  // --- Read data files ---
  const dataDir = path.join(PROJECT_ROOT, "data", username);

  const report = await readJSON(path.join(dataDir, "report.json"));
  if (!report) {
    console.error(`Error: report.json not found at ${dataDir}/report.json`);
    console.error("Run the analysis step first to generate the report.");
    process.exit(1);
  }

  const profile = await readJSON(path.join(dataDir, "profile.json"));
  if (!profile) {
    console.error(`Error: profile.json not found at ${dataDir}/profile.json`);
    console.error("Run the scraper first to generate profile data.");
    process.exit(1);
  }

  // --- Generate secret code ---
  const secretCode = crypto.randomBytes(4).toString("hex");

  // --- Build payload ---
  const payload = {
    secretCode,
    username,
    report,
    profile: {
      username: profile.username,
      scrapedAt: profile.scrapedAt,
      postCount: profile.posts ? profile.posts.length : 0,
    },
  };

  // --- Upload ---
  const uploadUrl = `${WORKER_URL}/api/upload`;
  console.log(`\nUploading report for @${username} to ${uploadUrl}...`);

  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UPLOAD_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`\nUpload failed (HTTP ${res.status}):`);
      console.error(body);
      process.exit(1);
    }

    const result = await res.json();
    console.log(`\n✅ Report uploaded successfully!`);
    console.log();
    console.log(`📋 Secret Code: ${secretCode}`);
    console.log(`🔗 URL: ${WORKER_URL}/report?code=${secretCode}`);
    console.log(`⏰ Expires: 48 hours from now`);

    if (result.message) {
      console.log(`\nServer: ${result.message}`);
    }
  } catch (err) {
    console.error(`\nUpload failed: ${err.message}`);
    process.exit(1);
  }
}

main();
