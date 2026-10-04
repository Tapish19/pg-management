import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { pathToFileURL } from "node:url";

// Use an installed Playwright package or pass its directory with PLAYWRIGHT_PATH.
const { chromium } = process.env.PLAYWRIGHT_PATH
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PATH, "index.mjs")).href)
  : await import("playwright");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pg-demo-browser-"));
const listener = net.createServer().listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [".output/server/index.mjs"], {
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    TURSO_DATABASE_URL: `file:${path.join(directory, "test.db")}`,
    TURSO_AUTH_TOKEN: "",
    JWT_SECRET: "demo-browser-test-secret",
  },
});
let logs = "",
  browser;
child.stdout.on("data", (data) => (logs += data));
child.stderr.on("data", (data) => (logs += data));
try {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(15000) });
      await response.text();
      if (response.ok) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [],
    requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/_serverFn/")) requests.push(request.url());
  });
  await page.goto(`${base}/auth`);
  await page.getByRole("button", { name: /^Owner \/ Admin Full analytics/ }).click();
  await page.waitForURL("**/dashboard");
  requests.length = 0;
  const routes = {
    admin: [
      "dashboard",
      "properties",
      "rooms",
      "bookings",
      "tenants",
      "matching",
      "payments",
      "staff",
      "food",
      "expenses",
      "complaints",
      "visitors",
      "notices",
      "reports",
      "settings",
      "profile",
      "notifications",
    ],
    staff: [
      "dashboard",
      "tasks",
      "complaints",
      "visitors",
      "bookings",
      "food",
      "notices",
      "profile",
      "notifications",
    ],
    tenant: [
      "dashboard",
      "my-room",
      "my-assistant",
      "pay-rent",
      "my-food",
      "my-complaints",
      "my-visitors",
      "notifications",
      "profile",
    ],
  };
  for (const [role, pages] of Object.entries(routes)) {
    await page.goto(`${base}/auth`);
    await page
      .getByRole("button", {
        name:
          role === "admin"
            ? /^Owner \/ Admin Full analytics/
            : role === "staff"
              ? /^Staff Tasks/
              : /^Tenant Room/,
      })
      .click();
    await page.waitForURL("**/dashboard");
    for (const route of pages) {
      await page.goto(`${base}/${route}`);
      await page.locator("h1").waitFor();
      await page.waitForTimeout(150);
      const body = await page.locator("body").innerText();
      assert.ok(
        !/Please (log|sign) in|Sign in with a real|No active booking found|This page didn't load|Could not load settings/.test(
          body,
        ),
        `${role}/${route}: ${body.slice(0, 400)}`,
      );
      assert.ok(page.url().endsWith(`/${route}`), `${role}/${route} accessible`);
    }
    await page.goto(`${base}/profile`);
    await page.locator("form").getByRole("textbox").first().fill(`${role} Demo Profile`);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.getByText("Profile updated", { exact: true }).waitFor();
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector("form input")?.value.endsWith("Demo Profile"),
    );
    if (role === "admin") {
      await page.goto(`${base}/settings`);
      await page
        .getByRole("tabpanel")
        .getByRole("textbox")
        .first()
        .fill("Demo organization edited");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await page.getByText("Demo settings saved on this browser", { exact: true }).waitFor();
      await page.reload();
      await page.waitForFunction(
        () =>
          document.querySelector('[role="tabpanel"] input')?.value === "Demo organization edited",
      );
    }
    console.log(`${role}: ${pages.length} demo pages and persisted profile passed`);
  }
  await page.goto(`${base}/pay-rent`);
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Pay ₹/ })
    .click();
  await page.getByText("Payment successful", { exact: true }).waitFor();
  await page.goto(`${base}/settings`);
  await page.waitForURL("**/dashboard");
  assert.equal(requests.length, 0, "Demo pages must never call authenticated server functions");
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "Browser demo passed: owner login, all role pages, local rent payment, forbidden route redirect and zero real-account requests.",
  );
} catch (error) {
  console.error(logs.slice(-3000));
  throw error;
} finally {
  await browser?.close();
  const exited = once(child, "exit");
  if (child.exitCode === null) {
    child.kill();
    await exited;
  }
  for (const name of fs.readdirSync(directory)) {
    const target = path.resolve(directory, name);
    assert.equal(path.dirname(target), directory);
    fs.unlinkSync(target);
  }
  fs.rmdirSync(directory);
}
