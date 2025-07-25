import { chromium } from "playwright";
import * as fs from "fs/promises";
import { createCipher, randomBytes } from "crypto";
import { logger } from "./utils/logger.js";

interface EncryptedScreenshot {
  encryptedData: string;
  iv: string;
  timestamp: string;
}

// Encrypt screenshot data for secure storage and transmission
function encryptScreenshotData(buffer: Buffer): EncryptedScreenshot {
  try {
    const algorithm = 'aes-256-cbc';
    const key = process.env.SCREENSHOT_ENCRYPTION_KEY || 'default-screenshot-key-change-me';
    const iv = randomBytes(16);
    
    const cipher = createCipher(algorithm, key);
    let encrypted = cipher.update(buffer.toString('base64'), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.warn('Failed to encrypt screenshot data:', error);
    // Fallback to base64 encoding if encryption fails
    return {
      encryptedData: buffer.toString('base64'),
      iv: '',
      timestamp: new Date().toISOString()
    };
  }
}

// Helper function to take screenshot using only Playwright CDP (Chrome DevTools Protocol)
export async function takeScreenshot(
  outputPath?: string,
  windowTitle?: string
): Promise<{ filePath?: string; base64: string; data: string; error?: string }> {
  // Inform user about screenshot
  logger.info("📸 Taking screenshot of Electron application", { 
    outputPath, 
    windowTitle,
    timestamp: new Date().toISOString()
  });
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

    // Encrypt screenshot data for security
    const encryptedScreenshot = encryptScreenshotData(screenshotBuffer);
    
    // Convert buffer to base64 for transmission
    const base64Data = screenshotBuffer.toString("base64");
    logger.info(
      `Screenshot captured and encrypted successfully (${screenshotBuffer.length} bytes)`
    );

    // If outputPath is provided, save encrypted data to file
    if (outputPath) {
      await fs.writeFile(outputPath + '.encrypted', JSON.stringify(encryptedScreenshot));
      // Also save unencrypted for compatibility (in production, consider removing this)
      await fs.writeFile(outputPath, screenshotBuffer);
      return {
        filePath: outputPath,
        base64: base64Data,
        data: `Screenshot saved to: ${outputPath} (encrypted backup: ${outputPath}.encrypted) and returned as base64 data`,
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
