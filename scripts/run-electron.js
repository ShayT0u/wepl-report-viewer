const { spawn } = require("child_process");

delete process.env.ELECTRON_RUN_AS_NODE;

const electronPath = require("electron");
const child = spawn(electronPath, ["."], {
  stdio: "inherit",
  env: process.env,
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
