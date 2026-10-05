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
    if (role === "tenant") {
      const roommateText = await page.getByText(/% compatible$/).innerText();
      await page.getByLabel("Sleep schedule", { exact: true }).selectOption("night_owl");
      await page.getByRole("button", { name: "Save preferences", exact: true }).click();
      await page.getByText("Preferences saved and matches recalculated", { exact: true }).waitFor();
      assert.notEqual(await page.getByText(/% compatible$/).innerText(), roommateText);
      await page.reload();
      await page.waitForFunction(
        () => document.querySelector("#prefs-sleepSchedule")?.value === "night_owl",
      );
    }
    if (role === "admin") {
      await page.goto(`${base}/settings`);
      await page.getByLabel("Organization name", { exact: true }).fill("x");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Organization name:" }).waitFor();
      await page
        .getByRole("tabpanel")
        .getByRole("textbox")
        .first()
        .fill("Demo organization edited");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await page.getByText("Demo settings saved", { exact: true }).waitFor();
      await page.reload();
      await page.waitForFunction(
        () =>
          document.querySelector('[role="tabpanel"] input')?.value === "Demo organization edited",
      );
      await page.getByRole("tab", { name: "Rent rules", exact: true }).click();
      await page.getByLabel("Rent due day of month", { exact: true }).fill("7");
      await page.getByLabel("Late fee (₹/day)", { exact: true }).fill("12.50");
      await page.getByLabel("Notice period (days)", { exact: true }).fill("45");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await page.waitForFunction(
        () => JSON.parse(localStorage.getItem("pgone.demo.settings.v1.u-admin")).dueDay === 7,
      );
      await page.getByRole("tab", { name: "Notifications", exact: true }).click();
      await page.getByRole("switch", { name: "Rent due reminders", exact: true }).click();
      await page.getByRole("button", { name: "Save preferences", exact: true }).click();
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("pgone.demo.settings.v1.u-admin")).notifications.rent ===
          false,
      );
      await page.getByRole("tab", { name: "Payments", exact: true }).click();
      await page.getByRole("switch", { name: "cash", exact: true }).click();
      await page.getByRole("button", { name: "Connect stripe demo", exact: true }).click();
      await page.reload();
      await page.getByRole("tab", { name: "Payments", exact: true }).click();
      assert.equal(
        await page.getByRole("switch", { name: "cash", exact: true }).getAttribute("data-state"),
        "unchecked",
      );
      await page.getByRole("button", { name: "Disconnect stripe demo", exact: true }).waitFor();
      await page.getByRole("tab", { name: "Roles", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "View access", exact: true }).count(), 1);
      assert.equal(await page.getByRole("button", { name: "Edit access", exact: true }).count(), 2);
      await page.setViewportSize({ width: 375, height: 812 });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        "Mobile Settings must not overflow the page",
      );
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    console.log(`${role}: ${pages.length} demo pages and persisted profile passed`);
  }
  await page.goto(`${base}/pay-rent`);
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  const methods = await page
    .getByLabel("Demo payment method", { exact: true })
    .locator("option")
    .allTextContents();
  assert.deepEqual(methods, ["UPI", "Stripe"], "Owner settings determine checkout options");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Pay ₹/ })
    .click();
  await page.getByText("Payment successful", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^WhatsApp demo/ }).click();
  await page
    .getByRole("dialog")
    .getByText(/Your .*rent payment.*is confirmed/)
    .waitFor();
  await page.getByRole("button", { name: "Mark messages read", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('[role="dialog"] button') &&
      [...document.querySelectorAll('[role="dialog"] button')].some(
        (button) => button.textContent.includes("Mark messages read") && button.disabled,
      ),
  );
  await page.keyboard.press("Escape");
  await page.goto(`${base}/settings`);
  await page.waitForURL("**/dashboard");
  await page.goto(`${base}/pay-rent`);
  await page.getByRole("button", { name: "Undo demo payment", exact: true }).click();
  await page.getByText("Demo payment undone. Rent is pending again.", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Pay ₹/ })
    .click();
  await page.getByText("Payment successful", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(requests.length, 0, "Demo pages must never call authenticated server functions");
  // Two isolated browsers share persistent records through a capability link.
  await page.goto(`${base}/auth`);
  await page.getByRole("button", { name: /^Owner \/ Admin Full analytics/ }).click();
  await page.waitForURL("**/dashboard");
  await page.goto(`${base}/settings`);
  await page.getByRole("tab", { name: "Notifications", exact: true }).click();
  await page.getByRole("button", { name: "Send demo preview", exact: true }).click();
  await page.getByText("Preview added to your WhatsApp demo inbox", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^WhatsApp demo/ }).click();
  await page
    .getByRole("dialog")
    .getByText(/Welcome to PG One's WhatsApp demo/)
    .waitFor();
  await page
    .getByRole("dialog")
    .getByText(/paid .*rent.*simulated demo payment/)
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("switch", { name: "Enable demo WhatsApp messages", exact: true }).click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent === "Send demo preview" && button.disabled,
    ),
  );
  await page.getByRole("switch", { name: "Enable demo WhatsApp messages", exact: true }).click();
  await page.getByRole("button", { name: "Create share link", exact: true }).click();
  const linkInput = page.getByLabel("Demo share link", { exact: true });
  await linkInput.waitFor();
  const link = await linkInput.inputValue();
  const secondContext = await browser.newContext();
  const resident = await secondContext.newPage();
  resident.on("pageerror", (error) => errors.push(error.message));
  await resident.goto(link);
  await resident.getByRole("button", { name: /^Tenant Room/ }).click();
  await resident.waitForURL("**/dashboard");
  await resident.getByRole("button", { name: /^WhatsApp demo/ }).click();
  await resident
    .getByRole("dialog")
    .getByText(/Your .*rent payment.*is confirmed/)
    .waitFor();
  assert.equal(
    await resident
      .getByRole("dialog")
      .getByText(/Welcome to PG One's WhatsApp demo/)
      .count(),
    0,
    "Owner messages must not appear in tenant inbox",
  );
  await resident.keyboard.press("Escape");
  await resident.goto(`${base}/profile`);
  await resident.locator("form").first().getByRole("textbox").first().fill("Shared Resident");
  await resident.getByRole("button", { name: "Save changes", exact: true }).click();
  await resident.getByText("Profile updated", { exact: true }).waitFor();
  await resident.getByLabel("ID document (PDF, PNG or JPEG, up to 2 MB)").setInputFiles({
    name: "sample-id.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nSample demo identity document\n%%EOF"),
  });
  await resident.getByRole("button", { name: "Upload document", exact: true }).click();
  await resident
    .getByText("Document uploaded. Your owner can review it now.", { exact: true })
    .waitFor();
  await page.goto(`${base}/tenants`);
  const row = page.getByRole("row").filter({ hasText: "Shared Resident" });
  await row.waitFor();
  await row.getByRole("button", { name: "Review document", exact: true }).click();
  await page.getByRole("dialog").getByText("sample-id.pdf · aadhaar", { exact: true }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download document", exact: true }).click();
  const documentDownload = await downloadPromise;
  assert.equal(documentDownload.suggestedFilename(), "sample-id.pdf");
  await page.keyboard.press("Escape");
  await page.goto(`${base}/settings`);
  await page.getByRole("tab", { name: "Roles", exact: true }).click();
  await page.getByRole("button", { name: "Edit access", exact: true }).nth(1).click();
  await page.getByRole("switch", { name: "tenant my-assistant", exact: true }).click();
  await page.getByRole("button", { name: "Save access", exact: true }).click();
  await page.getByText("Role access saved", { exact: true }).waitFor();
  await resident.reload();
  await resident.goto(`${base}/my-assistant`);
  await resident.waitForURL("**/dashboard");
  assert.equal(await resident.getByRole("link", { name: "Ask Assistant", exact: true }).count(), 0);
  await resident.goto(`${base}/profile`);
  assert.equal(
    await resident.locator("form").first().getByRole("textbox").first().inputValue(),
    "Shared Resident",
  );
  await resident.getByRole("button", { name: "Download document", exact: true }).waitFor();
  await secondContext.close();
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "Browser demo passed: all role pages, cross-browser shared records, KYC upload/review/download, role permissions and simulated rent.",
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
