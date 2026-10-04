import fs from "node:fs";
import path from "node:path";
const directory = "src/lib/api/functions";
const modules = fs
  .readdirSync(directory)
  .filter(
    (file) =>
      file.endsWith("-fns.ts") &&
      !["auth-fns.ts", "sample-data-fns.ts", "settings-fns.ts", "public-fns.ts"].includes(file),
  );
let source = 'import { withDemo } from "./demo-store";\n';
for (const [i, file] of modules.entries()) {
  const names = [
    ...fs
      .readFileSync(path.join(directory, file), "utf8")
      .matchAll(/export const (\w+) = createServerFn/g),
  ].map((match) => match[1]);
  source += `import * as api${i} from "./api/functions/${file.slice(0, -3)}";\n`;
  for (const name of names)
    source += `export const ${name} = withDemo("${name}", api${i}.${name});\n`;
}
fs.writeFileSync("src/lib/demo-api.ts", source);
for (const folder of ["src/routes", "src/hooks", "src/components/layout"])
  for (const file of fs.readdirSync(folder)) {
    if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
    if (folder === "src/routes" && !file.startsWith("_app.")) continue;
    const target = path.join(folder, file),
      old = fs.readFileSync(target, "utf8");
    const next = old.replace(/@\/lib\/api\/functions\/([\w-]+-fns)/g, (match, name) =>
      modules.includes(`${name}.ts`) ? "@/lib/demo-api" : match,
    );
    if (next !== old) fs.writeFileSync(target, next);
  }
