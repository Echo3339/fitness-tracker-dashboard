#!/usr/bin/env node

import crypto from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const deployDir = path.dirname(scriptPath);
const projectDir = path.dirname(deployDir);
const config = JSON.parse(
  await readFile(path.join(deployDir, "release-config.json"), "utf8"),
);
const sha256 = (contents) => crypto.createHash("sha256").update(contents).digest("hex");

export const buildApp = async (outfile) => {
  const outputPath = path.resolve(outfile);
  const { entryPoint, target, name: builder, version } = config.bundleBuilder;
  if (builder !== "esbuild" || !version || !entryPoint || !target) {
    throw new Error("deploy/release-config.json 的 bundleBuilder 配置无效");
  }
  const args = [
    "exec",
    "--yes",
    `--package=${builder}@${version}`,
    "--",
    builder,
    entryPoint,
    "--bundle",
    "--format=iife",
    `--target=${target}`,
    `--outfile=${outputPath}`,
  ];
  try {
    await execFileAsync("npm", args, {
      cwd: projectDir,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000,
    });
  } catch (error) {
    const detail = error.stderr?.trim() || error.message;
    throw new Error(`前端构建失败（${builder} ${version}）：${detail}`);
  }
  return outputPath;
};

export const verifyAppBundle = async () => {
  const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "whatsup-bundle-check-"));
  const rebuiltPath = path.join(temporaryDir, "app.bundle.js");
  try {
    await buildApp(rebuiltPath);
    const [current, rebuilt] = await Promise.all([
      readFile(path.join(projectDir, "app.bundle.js")),
      readFile(rebuiltPath),
    ]);
    const currentHash = sha256(current);
    const rebuiltHash = sha256(rebuilt);
    if (currentHash !== rebuiltHash) {
      throw new Error(
        `app.bundle.js 与源码构建结果不一致（当前 ${currentHash.slice(0, 12)}，应为 ${rebuiltHash.slice(0, 12)}）；运行 node deploy/build-app.mjs 后重新预检`,
      );
    }
    return { sha256: currentHash, bytes: current.byteLength };
  } finally {
    await rm(temporaryDir, { recursive: true, force: true });
  }
};

const main = async (args) => {
  if (args.length > 1 || (args[0] && !["--build", "--check"].includes(args[0]))) {
    throw new Error("用法：node deploy/build-app.mjs [--build|--check]");
  }
  if (args[0] === "--check") {
    const result = await verifyAppBundle();
    console.log(`bundle 与源码一致：${result.sha256} (${result.bytes} bytes)`);
    return;
  }
  const outputPath = path.join(projectDir, "app.bundle.js");
  await buildApp(outputPath);
  const bundle = await readFile(outputPath);
  console.log(`已从 ${config.bundleBuilder.entryPoint} 构建 app.bundle.js：${sha256(bundle)}`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[build-app] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
