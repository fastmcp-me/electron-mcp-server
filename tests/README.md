# Test Organization

This project follows a clean and organized test structure that separates concerns and makes tests easy to maintain.

## Directory Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   └── security-manager.test.ts
├── integration/             # Integration tests for full workflows  
│   └── electron-security-integration.test.ts
├── fixtures/                # Test data and mock files
├── support/                 # Test utilities and helpers
│   ├── config.ts           # Test configuration and constants
│   ├── setup.ts            # Global setup and teardown
│   └── helpers.ts          # Test utility functions
└── conftest.ts             # Global test configuration (like Python's conftest.py)
```

## Test Types

### Unit Tests (`tests/unit/`)
- Test individual functions, classes, and modules in isolation
- Fast execution, no external dependencies
- Use mocks and stubs for dependencies
- Example: Testing SecurityManager methods

### Integration Tests (`tests/integration/`) 
- Test complete workflows and component interactions
- May use real Electron processes and file system
- Test end-to-end functionality
- Example: Full MCP tool execution with security validation

### Support Files (`tests/support/`)

#### `config.ts`
- Centralized test configuration
- Constants for paths, timeouts, test data
- Security test vectors (risky commands, malicious paths)
- Electron app configuration

#### `helpers.ts`
- Reusable test utility functions
- Test Electron app creation and management
- File system cleanup utilities
- MCP request formatting helpers

#### `setup.ts`
- Global test setup and teardown
- Environment initialization
- Resource cleanup

### `conftest.ts`
- Global test configuration (inspired by Python's conftest.py)
- Imports and exports commonly used test utilities
- Sets up global test hooks
- Provides easy access to test helpers

## Usage Examples

### Writing Unit Tests
```typescript
import { describe, it, expect } from "vitest";
import { TEST_CONFIG } from "../conftest.js";
import { MyComponent } from "../../src/my-component.js";

describe("MyComponent", () => {
  it("should handle risky inputs", () => {
    TEST_CONFIG.SECURITY.RISKY_COMMANDS.forEach(cmd => {
      expect(MyComponent.isRisky(cmd)).toBe(true);
    });
  });
});
```

### Writing Integration Tests
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TestHelpers, type TestElectronApp } from "../conftest.js";

describe("Integration Test", () => {
  let testApp: TestElectronApp;

  beforeAll(async () => {
    testApp = await TestHelpers.createTestElectronApp();
  });

  afterAll(async () => {
    await testApp.cleanup();
  });
  
  // ... test cases
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm test tests/unit

# Run only integration tests  
npm test tests/integration

# Run with coverage
npm run test:coverage
```

## Benefits of This Structure

1. **Clear Separation**: Unit vs Integration tests are clearly separated
2. **Centralized Configuration**: All test constants and config in one place
3. **Reusable Utilities**: Common helpers shared across all tests
4. **Easy Maintenance**: Changes to test setup only need to be made in one place
5. **Scalable**: Easy to add new test types or categories
6. **Familiar Pattern**: Similar to Python's pytest structure with conftest.py
