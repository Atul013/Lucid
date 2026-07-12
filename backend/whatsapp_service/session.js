#!/usr/bin/env node
/**
 * Snapshot / restore the WhatsApp session directory.
 *
 *   node session.js backup    — snapshot the linked session
 *   node session.js restore   — put a snapshot back after corruption
 *
 * Why this exists: the session is not a token, it's a whole Chromium profile
 * (~130MB) backed by LevelDB. An unclean kill can leave it structurally corrupt,
 * and a corrupt profile is indistinguishable from no session — the bridge comes
 * back asking for a QR. On a server that means SSHing in and scanning a code
 * that rotates every ~20s, with the business phone in hand.
 *
 * Restoring a snapshot turns that into a 5-second command.
 *
 * Take a backup right after a successful link (the bridge logs "Client ready").
 */

const fs = require("fs");
const path = require("path");

const AUTH = process.env.WA_AUTH_PATH ?? path.join(__dirname, ".wwebjs_auth");
const SNAP = `${AUTH}-backup`;

const cmd = process.argv[2];

function copy(from, to, label) {
  if (!fs.existsSync(from)) {
    console.error(`✗ Nothing at ${from}`);
    process.exit(1);
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(`✓ ${label}\n  ${from}\n  → ${to}`);
}

if (cmd === "backup") {
  // Only meaningful once the account is actually linked.
  if (!fs.existsSync(path.join(AUTH, "session"))) {
    console.error("✗ No linked session found — link the account first, then back up.");
    process.exit(1);
  }
  copy(AUTH, SNAP, "Session backed up");
} else if (cmd === "restore") {
  console.log("Stop the bridge first (systemctl stop lucid-wa), or this will race Chromium.\n");
  copy(SNAP, AUTH, "Session restored");
} else {
  console.log("usage: node session.js backup|restore");
  process.exit(1);
}
