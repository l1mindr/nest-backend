```markdown
# nest-backend Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the `nest-backend` TypeScript codebase. You'll learn about file naming, import/export styles, commit conventions, and how to write and run tests. This guide is ideal for onboarding new contributors or maintaining consistency across the project.

## Coding Conventions

### File Naming
- **Pattern:** PascalCase for all files.
- **Example:**  
  - `UserService.ts`
  - `OrderController.ts`

### Import Style
- **Pattern:** Relative imports are used throughout the codebase.
- **Example:**
  ```typescript
  import { UserService } from './UserService';
  ```

### Export Style
- **Pattern:** Named exports are preferred.
- **Example:**
  ```typescript
  export const UserService = { /* ... */ };
  ```

### Commit Messages
- **Pattern:** Conventional commits with the `fix` prefix.
- **Example:**
  ```
  fix: correct user validation logic
  ```

## Workflows

### Code Fix Workflow
**Trigger:** When fixing a bug or issue in the codebase  
**Command:** `/fix`

1. Identify the bug or issue.
2. Create a new branch for your fix.
3. Make your changes following the coding conventions.
4. Write or update relevant tests (`*.test.*` files).
5. Commit your changes using the conventional commit style:
   ```
   fix: concise description of the fix
   ```
6. Push your branch and open a pull request.

## Testing Patterns

- **Test File Naming:** Test files follow the pattern `*.test.*` (e.g., `UserService.test.ts`).
- **Testing Framework:** Not explicitly detected; follow the pattern for test file naming.
- **Example Test File:**
  ```typescript
  // UserService.test.ts
  import { UserService } from './UserService';

  describe('UserService', () => {
    it('should return user data', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command | Purpose |
|---------|---------|
| /fix    | Start a bugfix workflow (branch, code, test, commit, PR) |
```
