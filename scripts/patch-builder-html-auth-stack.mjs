import fs from "node:fs";
import path from "node:path";

const stack =
  `  <script src="../talk-runtime.js"></script>\n` +
  `  <script src="../auth-current-user.js"></script>\n` +
  `  <script src="builder-actor-identity.js"></script>\n`;

function patch(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("builder-general-flow.js")) return false;
  if (content.includes("builder-actor-identity.js")) return false;
  content = content.replace(
    /<script src="builder-general-flow\.js"><\/script>/,
    `${stack}  <script src="builder-general-flow.js"></script>`
  );
  fs.writeFileSync(filePath, content);
  return true;
}

function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p);
    else if (name.name.endsWith(".html") && patch(p)) console.log("updated", p);
  }
}

walk("builder");
