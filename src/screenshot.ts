import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to take screenshot using Playwright CDP (Chrome DevTools Protocol)
export async function takeScreenshot(
  outputPath?: string,
  windowTitle?: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultPath = path.join(
    os.tmpdir(),
    `electron-screenshot-${timestamp}.png`
  );
  const finalPath = outputPath || defaultPath;

  try {
    // Try Playwright CDP approach first (preferred method - doesn't bring window to front)
    // This works on macOS and Windows as long as Electron has remote debugging enabled
    try {
      console.log("Attempting Playwright CDP screenshot...");
      
      // Connect to Electron's remote debugging port (default: 9222)
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      const contexts = browser.contexts();
      
      if (contexts.length === 0) {
        throw new Error('No browser contexts found');
      }
      
      const context = contexts[0];
      const pages = context.pages();
      
      if (pages.length === 0) {
        throw new Error('No pages found in the browser context');
      }
      
      // Find the main application page (skip DevTools pages)
      let targetPage = pages[0];
      for (const page of pages) {
        const url = page.url();
        const title = await page.title().catch(() => '');
        
        // Skip DevTools and about:blank pages
        if (!url.includes('devtools://') && 
            !url.includes('about:blank') &&
            title && 
            !title.includes('DevTools')) {
          targetPage = page;
          break;
        }
      }
      
      console.log(`Taking screenshot of page: ${targetPage.url()}`);
      
      // Take screenshot without bringing window to front
      await targetPage.screenshot({
        path: finalPath,
        type: 'png',
        fullPage: false
      });
      
      await browser.close();
      
      // Verify screenshot was created
      await fs.access(finalPath);
      console.log(`Screenshot saved successfully: ${finalPath}`);
      return finalPath;
      
    } catch (error) {
      console.warn(
        "Playwright CDP method failed, falling back to platform-specific tools:",
        error
      );
    }

    // Platform-specific fallbacks if Playwright CDP fails
    const execAsync = promisify(exec);

    if (process.platform === "darwin") {
      // macOS fallback - use screencapture (may capture wrong window)
      try {
        // Try to get Electron window ID and capture it directly
        const { stdout: processes } = await execAsync(
          'ps aux | grep -i "electron \\." | grep -v grep | head -1'
        );

        if (processes.trim()) {
          // Use screencapture with window selection (may bring to front)
          console.warn("Using macOS screencapture fallback - may bring window to front");
          await execAsync(`screencapture -w -t png "${finalPath}"`);
        } else {
          // Final fallback: full screen
          await execAsync(`screencapture -t png "${finalPath}"`);
        }
      } catch {
        await execAsync(`screencapture -t png "${finalPath}"`);
      }
    } else if (process.platform === "win32") {
      // Windows fallback - enhanced PowerShell with better window targeting
      try {
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int nFlags);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
}
public struct RECT {
    public int Left, Top, Right, Bottom;
}
"@

# Enhanced Electron window detection
$electronProcesses = Get-Process | Where-Object {$_.ProcessName -like "*electron*" -and $_.MainWindowHandle -ne 0}
$targetWindow = $null

# Try to find the best Electron window (visible and has a title)
foreach ($proc in $electronProcesses) {
    $hwnd = $proc.MainWindowHandle
    if ([Win32]::IsWindowVisible($hwnd)) {
        $titleBuilder = New-Object System.Text.StringBuilder 256
        [Win32]::GetWindowText($hwnd, $titleBuilder, 256)
        $title = $titleBuilder.ToString()
        
        # Prefer windows with meaningful titles
        if ($title -and $title -notlike "*Developer Tools*") {
            $targetWindow = $hwnd
            Write-Host "Found Electron window: $title"
            break
        }
    }
}

if ($targetWindow) {
    $rect = New-Object RECT
    [Win32]::GetWindowRect($targetWindow, [ref]$rect)
    
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    
    if ($width -gt 0 -and $height -gt 0) {
        $bitmap = New-Object System.Drawing.Bitmap $width, $height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $hdc = $graphics.GetHdc()
        
        # Use PrintWindow to capture without bringing to front
        $result = [Win32]::PrintWindow($targetWindow, $hdc, 0)
        $graphics.ReleaseHdc($hdc)
        $graphics.Dispose()
        
        if ($result) {
            $bitmap.Save("${finalPath}", [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Host "Screenshot captured successfully"
        } else {
            throw "PrintWindow failed"
        }
        $bitmap.Dispose()
    } else {
        throw "Invalid window dimensions"
    }
} else {
    # Fallback to full screen if no suitable Electron window found
    Write-Host "No suitable Electron window found, capturing full screen"
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bitmap.Save("${finalPath}", [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
}
`;
        await execAsync(`powershell -Command "${psScript}"`);
      } catch (winError) {
        // Simple fallback for Windows
        console.warn("Enhanced Windows screenshot failed, using basic method:", winError);
        const simpleScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $bitmap.Save("${finalPath}", [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()
        `;
        await execAsync(`powershell -Command "${simpleScript}"`);
      }
    } else {
      // Unsupported platform
      throw new Error(`Screenshot not supported on platform: ${process.platform}. Only macOS and Windows are supported.`);
    }

    return finalPath;
  } catch (error) {
    throw new Error(`Failed to take screenshot: ${error}`);
  }
}
