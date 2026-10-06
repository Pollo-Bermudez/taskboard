# Project: Taskboard

A fullstack task and board management web application built with TypeScript, Node.js, and React.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express / Fastify, TypeScript
- **Validation & Schemas**: Zod (shared types where applicable)
- **State Management**: React Query (@tanstack/react-query) / React Context
- **Testing**: Vitest / Jest, React Testing Library, Supertest

## Standard Commands
- Dev (Fullstack): `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Type Check: `npm run typecheck`

## Code Conventions
- **TypeScript**: Strict mode enabled. Avoid `any`; use `unknown` with type guards or Zod schemas.
- **Exports**: Prefer named exports over default exports.
- **Components**: Functional components with hooks only.
- **File Organization**:
  - `src/client/` - React frontend application.
  - `src/server/` - Node.js API server and controllers.
  - `src/shared/` - Shared types, schemas, and utility constants.
- **Testing**: Colocate unit/component tests next to source (e.g., `TaskCard.tsx` -> `TaskCard.test.tsx`).
- **Validation**: Validate all incoming HTTP payloads at API boundaries using Zod schemas.
- **Error Handling**: Use structured domain errors and standard HTTP response envelopes.

## Operational Boundaries & Safeguards
- **Secrets**: Never commit `.env` files, API keys, or credentials.
- **Verification**: Always run `npm run typecheck` and `npm test` before committing changes.
- **Database / Schema**: Ask before applying destructive database operations or schema alterations.
- **Context Economy**: When working on specific features, inspect only relevant slices of code (<2,000 lines). Do not dump the entire repository into context.

## Architectural Patterns

### 1. API Route & Controller Pattern (`src/server/`)
```typescript
import { Request, Response, NextFunction } from 'express';
import { CreateTaskSchema } from '../shared/schemas';
import * as taskService from '../services/taskService';

export async function createTaskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = CreateTaskSchema.parse(req.body);
    const task = await taskService.createTask(payload);
    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}
```

### 2. Client Component Pattern (`src/client/`)
```tsx
import React from 'react';
import type { Task } from '../shared/types';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: Task['status']) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange }) => {
  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
      <h3 className="font-semibold text-slate-800">{task.title}</h3>
      {task.description && <p className="text-sm text-slate-600 mt-1">{task.description}</p>}
      <div className="mt-3 flex justify-between items-center text-xs">
        <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">{task.status}</span>
        <button
          onClick={() => onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done')}
          className="text-blue-600 hover:underline"
        >
          Toggle Status
        </button>
      </div>
    </div>
  );
};
```

## Context Engineering Guidelines
- **Context Budget**: Start trimming working memory at ~75% capacity. Discard dead ends and verbose terminal output; protect active task constraints and errors.
- **Level 1 (Rules)**: This file (`AGENTS.md`) provides permanent baseline rules.
- **Level 2 (Specs)**: Reference `docs/specs/` for feature-specific specifications before implementation.
- **Level 3 (Files)**: Read target files and their tests before modifying.
- **Handling Ambiguity**: If specs and existing code conflict, surface the discrepancy explicitly with options rather than guessing.
