#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function readCoverage() {
  const file = path.join(root, "tests", "coverage.yaml");
  const text = fs.readFileSync(file, "utf8");
  const covered = new Set();
  let capability = null;
  let hasTests = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const capabilityMatch = rawLine.match(/^  ([a-z0-9-]+):\s*$/);
    if (capabilityMatch) {
      if (capability && hasTests) covered.add(capability);
      capability = capabilityMatch[1];
      hasTests = false;
      continue;
    }
    if (capability && rawLine.trim() === '"*":') {
      hasTests = true;
    }
  }
  if (capability && hasTests) covered.add(capability);
  return covered;
}

const specsDir = path.join(root, "openspec", "specs");
const coverage = readCoverage();
const missing = [];
for (const file of walk(specsDir)) {
  if (!file.endsWith("spec.md")) continue;
  const capability = path.basename(path.dirname(file));
  const content = fs.readFileSync(file, "utf8");
  const scenarios = content.match(/^#### Scenario: .+$/gm) ?? [];
  if (scenarios.length === 0) continue;
  if (!coverage.has(capability)) {
    missing.push(`${capability}: ${scenarios.length} scenario(s) have no coverage mapping`);
    continue;
  }
}

if (missing.length > 0) {
  console.error("Missing OpenSpec scenario coverage:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("OpenSpec scenario coverage check passed.");
