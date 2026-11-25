// EMBERLINE: Satay Night Market — entrypoint copier
//
// This program is the submission harness, not the game itself.
// Its job is deliberately small and repeatable: take the static
// game/ and screenshots/ trees that sit beside this file, mirror
// them byte-for-byte into the platform output directory, and then
// ask the vendored library to summarise that output as a dossier.
//
// Determinism notes:
//   - directory walks are ordered by plain code-unit comparison,
//     never by locale rules or by filesystem return order
//   - file contents are copied as raw bytes, with no re-encoding
//   - nothing here reads a clock, rolls dice, or shuffles input
//   - symlinks are skipped, never followed or copied: the output
//     tree contains only plain files and directories

import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDossier } from "./vendor/makefun-game.ts";

// --- locations -----------------------------------------------------------

// The folder containing this file is the entry root, wherever the
// runner happens to have mounted it.
const entryRoot = dirname(fileURLToPath(import.meta.url));

// The platform tells us where to deliver; /output is the fallback
// used for a plain local run.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// --- ordered, exact copying ---------------------------------------------

// Code-unit ordering: the one sort that means the same thing on
// every machine, unlike locale-aware comparison.
function compareNames(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Mirror one tree into its counterpart under the output directory.
// Directories are recreated, files are copied untouched, and any
// file called dossier.json is left out — that name belongs to the
// generated summary we write afterwards, not to the source trees.
function mirrorTree(sourceDir: string, targetDir: string): void {
  if (!existsSync(sourceDir)) return;

  mkdirSync(targetDir, { recursive: true });

  const entries = readdirSync(sourceDir, { withFileTypes: true });
  entries.sort((left, right) => compareNames(left.name, right.name));

  for (const entry of entries) {
    const from = join(sourceDir, entry.name);
    const to = join(targetDir, entry.name);

    // lstat (not stat) so a symlink is seen as a symlink itself:
    // skip it outright rather than following or copying it.
    if (lstatSync(from).isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      mirrorTree(from, to);
    } else if (entry.isFile()) {
      if (entry.name === "dossier.json") continue;
      // copyFileSync moves the bytes as-is; no text pass in between.
      copyFileSync(from, to);
    }
    // Anything that is neither a plain file nor a directory is
    // ignored rather than followed — links have no place here.
  }
}

// --- run -------------------------------------------------------------------

mkdirSync(outputDir, { recursive: true });

// The two payload trees, in a fixed order.
for (const treeName of ["game", "screenshots"]) {
  mirrorTree(join(entryRoot, treeName), join(outputDir, treeName));
}

// Summarise the delivered output (not the source) so the dossier
// describes exactly what was handed in. The caps are generous on
// purpose: they should describe this entry comfortably, not trim it.
const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 4 * 1024 * 1024,
  screenshots: { max: 8, max_bytes: 4 * 1024 * 1024 },
  game_max_files: 1024,
  game_max_bytes: 64 * 1024 * 1024,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, "dossier.json"), dossierBytes);

// Sanity check: the summary file should now be sitting in the output.
if (!existsSync(join(outputDir, "dossier.json"))) {
  throw new Error("dossier.json was not written to the output directory");
}
