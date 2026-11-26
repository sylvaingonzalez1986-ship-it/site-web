import { createServer } from "node:http";

const emptyTables = new Set([
  "blog_posts", "cms_pages", "pack_components", "page_sections", "producers", "products", "site_content",
]);

createServer((request, response) => {
  const path = request.url?.split("?", 1)[0];
  const table = /^\/rest\/v1\/([a-z_]+)$/.exec(path ?? "")?.[1];
  if (request.method === "GET" && emptyTables.has(table)) {
    response.writeHead(200, { "Content-Type": "application/json", "Content-Range": "*/0" });
    response.end("[]");
  } else {
    response.writeHead(404).end();
  }
}).listen(3190, "127.0.0.1");
