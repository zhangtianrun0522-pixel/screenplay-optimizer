#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const port = Number(process.env.SCRIPT_AGENT_PREVIEW_PORT || process.env.PORT || 4000);
const nodeVersion = process.versions.node;
const [nodeMajor, nodeMinor] = nodeVersion.split(".").map(Number);

function fail(message) {
  console.error(`\n[preview guard] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[preview guard] ${message}`);
}

function checkNodeVersion() {
  const supported =
    nodeMajor > 20 ? nodeMajor < 23 : nodeMajor === 20 && nodeMinor >= 9;

  if (supported) {
    return;
  }

  const node20Hint = "/opt/homebrew/opt/node@20/bin";
  fail(
    [
      `Unsupported Node.js ${nodeVersion}. This project expects Node.js >=20.9 <23.`,
      "Use Node 20 LTS for local preview.",
      `On this Mac, try: PATH=${node20Hint}:$PATH npm run dev:web`,
    ].join("\n")
  );
}

function checkPort() {
  if (Number.isInteger(port) && port > 0 && port < 65536) {
    return;
  }

  fail(
    `Invalid preview port "${process.env.SCRIPT_AGENT_PREVIEW_PORT || process.env.PORT}". Use a number from 1 to 65535.`
  );
}

function checkPortAvailable() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Stop the existing preview before starting a new one.`
          )
        );
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve());
    });

    server.listen(port, "127.0.0.1");
  });
}

function processCwd(pid) {
  const result = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return null;
  }

  const cwdLine = result.stdout
    .split("\n")
    .find((line) => line.startsWith("n"));

  return cwdLine ? path.resolve(cwdLine.slice(1)) : null;
}

function findNextDevProcesses() {
  const result = spawnSync("ps", ["-ax", "-o", "pid=,ppid=,command="], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    warn("Could not inspect running processes; continuing with port check only.");
    return [];
  }

  const candidates = [];

  for (const line of result.stdout.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) {
      continue;
    }

    const pid = Number(match[1]);
    const ppid = Number(match[2]);
    const command = match[3];

    if (pid === process.pid || ppid === process.pid) {
      continue;
    }

    const isNextCli =
      command.includes("next dev") && command.includes(`-p ${port}`);
    const isNextServer = command.includes(
      "node_modules/next/dist/server/lib/start-server.js"
    );

    if (!isNextCli && !isNextServer) {
      continue;
    }

    const cwd = processCwd(pid);
    const commandLooksLocal =
      command.includes("/web/node_modules/") ||
      command.includes("./node_modules/.bin/next");

    if (cwd === webRoot || (cwd === null && commandLooksLocal)) {
      candidates.push({ pid, command });
    }
  }

  return candidates;
}

function checkNoStaleNextDev() {
  const staleProcesses = findNextDevProcesses();

  if (staleProcesses.length === 0) {
    return;
  }

  const pidList = staleProcesses.map((processInfo) => processInfo.pid).join(" ");
  const processLines = staleProcesses
    .map((processInfo) => `- ${processInfo.pid}: ${processInfo.command}`)
    .join("\n");

  fail(
    [
      "Found existing Next dev process(es) for this project:",
      processLines,
      "",
      `Stop them first: kill ${pidList}`,
      "Then remove the cache only after the processes are gone: rm -rf .next",
    ].join("\n")
  );
}

async function main() {
  process.chdir(webRoot);
  checkNodeVersion();
  checkPort();

  try {
    await checkPortAvailable();
  } catch (error) {
    fail(error.message || String(error));
  }

  checkNoStaleNextDev();

  const nextArgs = [
    "node_modules/next/dist/bin/next",
    "dev",
    "-p",
    String(port),
    "--disable-source-maps",
    ...process.argv.slice(2),
  ];

  const child = spawn(process.execPath, nextArgs, {
    cwd: webRoot,
    env: process.env,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    fail(`Failed to start Next dev server: ${error.message}`);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

await main();
