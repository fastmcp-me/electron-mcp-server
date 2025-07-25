import { chromium } from "playwright";
import * as fs from "fs/promises";
import { logger } from "./utils/logger.js";

// Helper function to take screenshot using only Playwright CDP (Chrome DevTools Protocol)
export async function takeScreenshot(
  outputPath?: string,
  windowTitle?: string
): Promise<{ filePath?: string; base64: string; data: string }> {
  try {
    // Connect to Electron's remote debugging port (default: 9222)
    const browser = await chromium.connectOverCDP("http://localhost:9222");
    const contexts = browser.contexts();

    if (contexts.length === 0) {
      throw new Error(
        "No browser contexts found - make sure Electron app is running with remote debugging enabled"
      );
    }

    const context = contexts[0];
    const pages = context.pages();

    if (pages.length === 0) {
      throw new Error("No pages found in the browser context");
    }

    // Find the main application page (skip DevTools pages)
    let targetPage = pages[0];
    for (const page of pages) {
      const url = page.url();
      const title = await page.title().catch(() => "");

      // Skip DevTools and about:blank pages
      if (
        !url.includes("devtools://") &&
        !url.includes("about:blank") &&
        title &&
        !title.includes("DevTools")
      ) {
        // If windowTitle is specified, try to match it
        if (
          windowTitle &&
          title.toLowerCase().includes(windowTitle.toLowerCase())
        ) {
          targetPage = page;
          break;
        } else if (!windowTitle) {
          targetPage = page;
          break;
        }
      }
    }

    logger.info(
      `Taking screenshot of page: ${targetPage.url()} (${await targetPage.title()})`
    );

    // Take screenshot as buffer (in memory)
    const screenshotBuffer = await targetPage.screenshot({
      type: "png",
      fullPage: false,
    });

    await browser.close();

    // Convert buffer to base64
    const base64Data = screenshotBuffer.toString("base64");
    logger.info(
      `Screenshot captured successfully (${screenshotBuffer.length} bytes)`
    );

    // If outputPath is provided, also save to file
    if (outputPath) {
      await fs.writeFile(outputPath, screenshotBuffer);
      return {
        filePath: outputPath,
        base64: base64Data,
        data: `Screenshot saved to: ${outputPath} and returned as base64 data`,
      };
    } else {
      return {
        base64: base64Data,
        data: `Screenshot captured as base64 data (${screenshotBuffer.length} bytes) - no file saved`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Screenshot failed: ${errorMessage}. Make sure the Electron app is running with remote debugging enabled (--remote-debugging-port=9222)`
    );
  }
}
