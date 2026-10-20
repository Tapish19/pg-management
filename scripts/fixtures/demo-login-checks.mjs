import assert from "node:assert/strict";

const choices = {
  admin: /^Owner \/ Admin Full analytics/,
  staff: /^Staff Tasks/,
  tenant: /^Tenant Room/,
};
const labels = { admin: "Owner / Admin", staff: "Staff", tenant: "Tenant" };
const pause = () => {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
};
async function contextFor(browser) {
  const context = await browser.newContext();
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
  return context;
}
async function assertRole(page, role) {
  await page.getByRole("button", { name: `Demo ${labels[role]}`, exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem("pgone.session.v1"))?.role),
    role,
  );
}

export async function checkLocalDemoLogin(browser, base, authIds) {
  for (const role of Object.keys(choices)) {
    const context = await contextFor(browser);
    const page = await context.newPage();
    const gate = pause();
    let pendingChecks = 0;
    await context.route("**/_serverFn/**", async (route) => {
      if (authIds.some((id) => route.request().url().includes(id))) {
        pendingChecks++;
        await gate.promise;
      }
      await route.continue().catch(() => {});
    });
    try {
      await page.goto(`${base}/auth`);
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (button) => button.textContent.includes("Full analytics") && !button.disabled,
        ),
      );
      const started = Date.now();
      await page.getByRole("button", { name: choices[role] }).click();
      await page.waitForURL("**/dashboard", { timeout: 3000 });
      await assertRole(page, role);
      assert.ok(pendingChecks > 0, "Real session restoration was still waiting at demo login");
      gate.release();
      await page.waitForTimeout(200);
      await assertRole(page, role);
      console.log(
        `${role}: single-click local demo opened in ${Date.now() - started}ms with session checks delayed`,
      );
    } finally {
      gate.release();
      await context.close();
    }
  }
}

export async function checkSharedDemoLogin(browser, link, sharedActionId) {
  const context = await contextFor(browser);
  const page = await context.newPage();
  let gate = pause();
  let snapshotCount = 0;
  await context.route(`**/_serverFn/${sharedActionId}*`, async (route) => {
    if (route.request().postData()?.includes("snapshot")) {
      snapshotCount++;
      await gate.promise;
    }
    await route.continue().catch(() => {});
  });
  try {
    await page.goto(link);
    await page.getByRole("button", { name: choices.tenant }).click();
    await page.getByText("Opening your demo…", { exact: true }).waitFor();
    assert.equal(await page.locator("button[aria-busy][disabled]").count(), 3);
    // Even programmatic rapid clicks on other buttons must not start competing logins.
    await page.evaluate(() => {
      for (const button of document.querySelectorAll("button[aria-busy]")) button.click();
    });
    await page.waitForTimeout(100);
    assert.equal(snapshotCount, 1, "Only one initial workspace load is issued");
    assert.equal(await page.evaluate(() => localStorage.getItem("pgone.session.v1")), null);
    gate.release();
    await page.waitForURL("**/dashboard");
    await assertRole(page, "tenant");

    // Existing shared records let every role open while the next refresh is still waiting.
    for (const role of ["admin", "staff", "tenant"]) {
      gate = pause();
      await page.goto(link);
      const started = Date.now();
      await page.getByRole("button", { name: choices[role] }).click();
      await page.waitForURL("**/dashboard", { timeout: 3000 });
      await assertRole(page, role);
      gate.release();
      await page.waitForTimeout(200);
      await assertRole(page, role);
      console.log(
        `${role}: cached shared demo opened in ${Date.now() - started}ms with refresh delayed`,
      );
    }

    // A slow first load must recover with an error and a working retry, not a half-login.
    await page.evaluate(() => localStorage.clear());
    gate = pause();
    await page.goto(link);
    await page.getByRole("button", { name: choices.staff }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "taking too long" })
      .waitFor({ timeout: 12000 });
    assert.equal(await page.evaluate(() => localStorage.getItem("pgone.session.v1")), null);
    assert.equal(await page.locator("button[aria-busy]:disabled").count(), 0);
    gate.release();
    await page.getByRole("button", { name: choices.staff }).click();
    await page.waitForURL("**/dashboard");
    await assertRole(page, "staff");

    // Switching to a missing workspace must never use another workspace's cached records.
    await page.evaluate(() => localStorage.removeItem("pgone.session.v1"));
    const missingLink = new URL(link);
    missingLink.searchParams.set("demo", "00000000-0000-4000-8000-000000000000");
    await page.goto(missingLink.href);
    await page.getByRole("button", { name: choices.admin }).click();
    await page.getByRole("alert").filter({ hasText: "Shared demo not found" }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("pgone.session.v1")), null);
    console.log(
      "Shared login: single request, locked role choice, timeout/retry and workspace isolation passed",
    );
  } finally {
    gate.release();
    await context.close();
  }
}
