import { expect, test, type Page } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const emlPath = (name: string) => join(__dirname, "..", "..", "emails", name);

// Each test's video is converted to a named GIF by scripts/make-gifs.sh (matched by
// the test title slug). Runs serially on the shared fresh chain.
test.describe.configure({ mode: "serial" });

const beat = (page: Page, ms = 900) => page.waitForTimeout(ms);

test("browse and trade", async ({ page }) => {
  await page.goto("/");
  await beat(page);
  await page.getByTestId("market-card-0").scrollIntoViewIfNeeded();
  await beat(page);
  await page.getByTestId("market-card-0").click(); // Fed rate cut
  await expect(page.getByTestId("market-question")).toBeVisible();
  await beat(page, 1100); // let the chart render
  await page.getByTestId("side-yes").click();
  await page.getByTestId("amount-input").fill("2000");
  await beat(page, 1200); // "To win" + avg price compute
  await page.getByTestId("trade-submit").click();
  await expect(page.getByTestId("positions-panel")).toBeVisible({ timeout: 20_000 });
  await beat(page, 1400); // toast + price move + position
});

test("create a market", async ({ page }) => {
  await page.goto("/#/create");
  await beat(page);
  await page.getByTestId("create-question").fill("Will the ECB cut rates this quarter?");
  await beat(page);
  await page.getByTestId("create-next").click();
  await beat(page);
  await page.getByTestId("newspaper-email.reuters.com").click();
  await beat(page);
  await page.getByTestId("create-next").click();
  await beat(page);
  await page.getByTestId("create-regex").fill("(?i)ecb (cuts|lowers) rates");
  await page.getByTestId("create-test-subject").fill("Breaking News: ECB cuts rates by 25bps");
  await beat(page, 1200); // live "Matches" feedback
  await page.getByTestId("create-next").click();
  await page.getByTestId("create-liquidity").fill("1500");
  await beat(page, 900);
  await page.getByTestId("create-submit").click();
  await expect(page.getByTestId("market-question")).toContainText("ECB", { timeout: 30_000 });
  await beat(page, 1200);
});

test("settle with a real DKIM proof", async ({ page }) => {
  await page.goto("/#/market/0");
  await expect(page.getByTestId("resolution-panel")).toBeVisible();
  await beat(page, 900);
  // NYT alert: real DKIM signature verified onchain
  await page.getByTestId("eml-input").setInputFiles(emlPath("nyt-fed-cut.eml"));
  await expect(page.getByTestId("proof-check-ok")).toBeVisible();
  await beat(page, 1500); // show the DKIM-verified email card
  await page.getByTestId("submit-proof").click();
  await expect(page.getByTestId("source-status")).toContainText("Fed cuts rates", { timeout: 20_000 });
  await beat(page, 1100);
  // Washington Post alert reaches 2-of-3 -> YES
  await page.getByTestId("eml-input").setInputFiles(emlPath("wapo-fed-cut.eml"));
  await expect(page.getByTestId("proof-check-ok")).toBeVisible();
  await beat(page, 1200);
  await page.getByTestId("submit-proof").click();
  await expect(page.getByTestId("resolution-panel")).toContainText("Resolved YES", { timeout: 20_000 });
  await beat(page, 1600); // celebrate
});
