import { exec } from "child_process";
import { promisify } from "util";

// Helper function to check if Electron is installed (global or local)
export async function isElectronInstalled(appPath?: string): Promise<boolean> {
  try {
    const execAsync = promisify(exec);
    
    if (appPath) {
      // Check for local Electron installation in the project
      try {
        await execAsync("npm list electron", { cwd: appPath });
        return true;
      } catch (localError) {
        // If local check fails, try global
        console.warn("Local Electron not found, checking global installation");
      }
    }
    
    // Check for global Electron installation
    await execAsync("electron --version");
    return true;
  } catch (error) {
    console.error("Electron not found:", error);
    return false;
  }
}
