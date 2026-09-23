import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { request as httpsRequest } from "node:https";
import hostingConfig from "../../.openai/hosting.json";
import { sites } from "./sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const remoteApiProxyTarget = process.env.FLY_REMOTE_API_PROXY;

const localSignedStorageProxy: Plugin = {
  name: "local-signed-storage-proxy",
  configureServer(server) {
    server.middlewares.use("/__s3_proxy", (request: IncomingMessage, response: ServerResponse) => {
      const signedUrl = new URL(request.url ?? "", "http://localhost").searchParams.get("url");
      if (!signedUrl) {
        response.writeHead(400).end("Missing signed upload URL.");
        return;
      }

      let target: URL;
      try {
        target = new URL(signedUrl);
      } catch {
        response.writeHead(400).end("Invalid signed upload URL.");
        return;
      }
      if (target.protocol !== "https:" || !target.hostname.endsWith(".amazonaws.com")) {
        response.writeHead(400).end("Unsupported signed upload host.");
        return;
      }

      const headers = { ...request.headers };
      delete headers.connection;
      delete headers.host;
      delete headers.origin;
      delete headers.referer;
      const requestToStorage = httpsRequest(target, { headers, method: request.method }, (storageResponse) => {
        response.writeHead(storageResponse.statusCode ?? 502, storageResponse.headers);
        storageResponse.pipe(response);
      });
      requestToStorage.once("error", () => response.writeHead(502).end("Storage upload failed."));
      request.pipe(requestToStorage);
    });
  },
};

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
      ...(remoteApiProxyTarget ? {
        proxy: {
          "/api/v1": {
            changeOrigin: true,
            headers: { origin: remoteApiProxyTarget },
            secure: true,
            target: remoteApiProxyTarget,
          },
        },
      } : {}),
    },
    plugins: [
      ...(remoteApiProxyTarget ? [localSignedStorageProxy] : []),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        // The Playwright web server runs in a restricted environment where
        // Wrangler's default inspector port cannot bind. Keep normal local
        // debugging unchanged and disable only for browser UI test runs.
        inspectorPort: process.env.PLAYWRIGHT_UI === "1" ? false : undefined,
        config: localBindingConfig,
      }),
    ],
  };
});
