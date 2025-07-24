import { executeInElectron, findElectronTarget, DevToolsTarget } from "./electron-connection.js";
import { generateFindElementsCommand, generateClickByTextCommand } from "./electron-commands.js";
import { 
  generateFillInputCommand, 
  generateSelectOptionCommand, 
  generatePageStructureCommand 
} from "./electron-input-commands.js";

export interface CommandArgs {
  selector?: string;
  text?: string;
  value?: string;
  placeholder?: string;
  message?: string;
  code?: string;
}

/**
 * Enhanced command executor with improved React support
 */
export async function sendCommandToElectron(
  command: string,
  args?: CommandArgs
): Promise<string> {
  try {
    const target = await findElectronTarget();
    let javascriptCode: string;

    switch (command.toLowerCase()) {
      case "get_title":
        javascriptCode = "document.title";
        break;

      case "get_url":
        javascriptCode = "window.location.href";
        break;

      case "get_body_text":
        javascriptCode = "document.body.innerText.substring(0, 500)";
        break;

      case "click_button":
        javascriptCode = `document.querySelector('${
          args?.selector || "button"
        }')?.click(); 'Button clicked'`;
        break;

      case "find_elements":
        javascriptCode = generateFindElementsCommand();
        break;

      case "click_by_text":
        javascriptCode = generateClickByTextCommand(args?.text || "");
        break;

      case "fill_input":
        javascriptCode = generateFillInputCommand(
          args?.selector || "",
          args?.value || args?.text || "",
          args?.text || args?.placeholder || ""
        );
        break;

      case "select_option":
        javascriptCode = generateSelectOptionCommand(
          args?.selector || "",
          args?.value || "",
          args?.text || ""
        );
        break;

      case "get_page_structure":
        javascriptCode = generatePageStructureCommand();
        break;

      case "console_log":
        javascriptCode = `console.log('MCP Command:', '${
          args?.message || "Hello from MCP!"
        }'); 'Console message sent'`;
        break;

      case "eval":
        javascriptCode = args?.code || command;
        break;

      default:
        javascriptCode = command;
    }

    return await executeInElectron(javascriptCode, target);
  } catch (error) {
    throw new Error(
      `Failed to send command: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Enhanced click function with better React support
 */
export async function clickByText(text: string): Promise<string> {
  return sendCommandToElectron("click_by_text", { text });
}

/**
 * Enhanced input filling with React state management
 */
export async function fillInput(
  searchText: string,
  value: string,
  selector?: string
): Promise<string> {
  return sendCommandToElectron("fill_input", {
    selector,
    value,
    text: searchText,
  });
}

/**
 * Enhanced select option with proper event handling
 */
export async function selectOption(
  value: string,
  selector?: string,
  text?: string
): Promise<string> {
  return sendCommandToElectron("select_option", {
    selector,
    value,
    text,
  });
}

/**
 * Get comprehensive page structure analysis
 */
export async function getPageStructure(): Promise<string> {
  return sendCommandToElectron("get_page_structure");
}

/**
 * Get enhanced element analysis
 */
export async function findElements(): Promise<string> {
  return sendCommandToElectron("find_elements");
}

/**
 * Execute custom JavaScript with error handling
 */
export async function executeCustomScript(code: string): Promise<string> {
  return sendCommandToElectron("eval", { code });
}

/**
 * Basic page information commands
 */
export async function getTitle(): Promise<string> {
  return sendCommandToElectron("get_title");
}

export async function getUrl(): Promise<string> {
  return sendCommandToElectron("get_url");
}

export async function getBodyText(): Promise<string> {
  return sendCommandToElectron("get_body_text");
}
