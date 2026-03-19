#!/usr/bin/env node
// GitHub webhook listener for auto-deploying PocketBase hooks.
// Listens on port 9500, validates signature, runs vps-autodeploy.sh.
//
// Setup:
//   1. Generate a secret: openssl rand -hex 32
//   2. Set it in /etc/webhook-listener.env as WEBHOOK_SECRET=<secret>
//   3. Add the same secret in GitHub repo → Settings → Webhooks

const http = require("http");
const crypto = require("crypto");
const { execFile } = require("child_process");

const PORT = 9500;
const DEPLOY_SCRIPT = "/opt/wiedisync-repo/scripts/vps-autodeploy.sh";
const SECRET = process.env.WEBHOOK_SECRET;

if (!SECRET) {
  console.error("WEBHOOK_SECRET not set. Exiting.");
  process.exit(1);
}

function verifySignature(payload, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404);
    return res.end("Not found");
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const sig = req.headers["x-hub-signature-256"];
    if (!verifySignature(body, sig)) {
      console.log(`[${new Date().toISOString()}] Invalid signature, rejecting`);
      res.writeHead(401);
      return res.end("Invalid signature");
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      return res.end("Invalid JSON");
    }

    const ref = payload.ref || "";
    const branch = ref.replace("refs/heads/", "");

    if (!["main", "dev"].includes(branch)) {
      console.log(`[${new Date().toISOString()}] Ignoring branch: ${branch}`);
      res.writeHead(200);
      return res.end("Ignored branch");
    }

    // Check if pb_hooks/ files were changed
    const commits = payload.commits || [];
    const changedFiles = commits.flatMap((c) => [
      ...(c.added || []),
      ...(c.modified || []),
      ...(c.removed || []),
    ]);
    const hooksChanged = changedFiles.some((f) => f.startsWith("pb_hooks/"));

    if (!hooksChanged) {
      console.log(
        `[${new Date().toISOString()}] No pb_hooks changes, skipping`
      );
      res.writeHead(200);
      return res.end("No hooks changed");
    }

    console.log(
      `[${new Date().toISOString()}] Deploying ${branch} (${changedFiles.filter((f) => f.startsWith("pb_hooks/")).join(", ")})`
    );

    // Run deploy script (don't wait — respond immediately)
    execFile("sudo", ["/bin/bash", DEPLOY_SCRIPT, branch], (err, stdout, stderr) => {
      if (err) console.error(`Deploy error: ${err.message}\n${stderr}`);
      else console.log(`Deploy output: ${stdout}`);
    });

    res.writeHead(200);
    res.end("Deploy triggered");
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Webhook listener running on 127.0.0.1:${PORT}`);
});
