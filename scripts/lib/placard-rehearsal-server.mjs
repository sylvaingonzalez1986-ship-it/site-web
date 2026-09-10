import { createServer } from "node:http";
import next from "next";

if (process.env.PLACARD_REHEARSAL_CONFIRM !== "LOCAL_DISPOSABLE_ONLY"
  || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321") {
  throw new Error("Serveur de recette réservé à Supabase local.");
}
const app = next({
  dev: true,
  hostname: "127.0.0.1",
  port: 3107,
  conf: {
    distDir: "output/placard-rehearsal-build",
    images: { unoptimized: true },
    serverExternalPackages: ["@napi-rs/canvas"],
  },
});
await app.prepare();
const handle = app.getRequestHandler();
const server = createServer((req, res) => handle(req, res));
server.listen(3107, "127.0.0.1", () => console.log("Serveur de recette local prêt sur le port 3107."));
process.on("SIGTERM", () => {
  server.close();
  void app.close().then(() => process.exit(0));
});
