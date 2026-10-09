const { spawnSync } = require("node:child_process");

const buildTimestamp = new Date().toISOString();

console.log(`Building YS Brain: ${buildTimestamp}`);

const expoResult = spawnSync(
  "npx",
  ["expo", "export", "--platform", "web"],
  {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      EXPO_PUBLIC_BUILD_TIMESTAMP: buildTimestamp,
    },
  }
);

if (expoResult.status !== 0) {
  process.exit(expoResult.status ?? 1);
}

const workboxResult = spawnSync(
  "npx",
  ["workbox", "generateSW", "workbox-config.cjs"],
  {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      EXPO_PUBLIC_BUILD_TIMESTAMP: buildTimestamp,
    },
  }
);

if (workboxResult.status !== 0) {
  process.exit(workboxResult.status ?? 1);
}

console.log(`YS Brain build completed: ${buildTimestamp}`);
