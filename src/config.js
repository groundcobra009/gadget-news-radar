// 設定ファイルの読み込みとパス定義。
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_DIR = path.join(REPO_ROOT, "config");
export const OUT_DIR = path.join(REPO_ROOT, "out");
export const DATA_DIR = path.join(REPO_ROOT, "data");
export const PROCESSED_PATH = path.join(DATA_DIR, "processed-items.json");
export const CANDIDATES_PATH = path.join(OUT_DIR, "candidates.json");
export const JUDGMENTS_PATH = path.join(OUT_DIR, "judgments.json");

function readYaml(file) {
  return yaml.load(fs.readFileSync(path.join(CONFIG_DIR, file), "utf-8"));
}

export function loadFeeds() {
  const feeds = readYaml("feeds.yaml");
  if (!Array.isArray(feeds) || feeds.length === 0) {
    throw new Error("config/feeds.yaml が空です");
  }
  return feeds;
}

export function loadKeywordGroups() {
  const groups = readYaml("keywords.yaml");
  return Array.isArray(groups) ? groups : [];
}

export function loadProfile() {
  return fs.readFileSync(path.join(CONFIG_DIR, "profile.md"), "utf-8");
}

export function ensureDirs() {
  for (const dir of [OUT_DIR, DATA_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** JSONを読む。無ければ null（呼び出し側で「未判定」に倒す） */
export function readJsonOrNull(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
