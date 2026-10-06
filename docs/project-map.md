# Project Map

Use this map to selectively load context for specific tasks instead of loading the entire codebase.

## 1. Shared Layer (`src/shared/`)
Contains contracts, validation schemas, and shared utilities used by both frontend and backend.
- **Key Files**:
  - `src/shared/types/task.ts`: Core Task, Column, Board types.
  - `src/shared/schemas/task.ts`: Zod validation schemas for requests.
- **Pattern**: Zero external runtime dependencies except `zod`. Types are strictly exported.

## 2. Server / Backend API (`src/server/`)
Node.js REST API handling board state, persistence, and business logic.
- **Key Files**:
  - `src/server/routes/tasks.ts`: Route definitions.
  - `src/server/controllers/tasks.ts`: HTTP request/response handlers.
  - `src/server/services/taskService.ts`: Business logic and data operations.
  - `src/server/middleware/errorHandler.ts`: Centralized error handling.
- **Pattern**: Routes delegate to controllers -> services. Zod validates at the controller boundary.

## 3. Client / Frontend UI (`src/client/`)
React SPA built with Vite and Tailwind CSS.
- **Key Files**:
  - `src/client/components/Board/`: Kanban board, columns, drag-and-drop or status toggles.
  - `src/client/components/TaskCard/`: Individual task presentation and action triggers.
  - `src/client/api/taskClient.ts`: Typed fetch / React Query API client.
- **Pattern**: Functional components with hooks, colocated tests, Tailwind utility styling.

## 4. Documentation & Specifications (`docs/`)
- `docs/architecture.md`: System design, data flow, and technology choices.
- `docs/specs/`: Feature-specific PRDs and specifications.
