# Antigravity Rules - Taskboard

Please refer to and follow [AGENTS.md](./AGENTS.md) for project-wide conventions, tech stack guidelines, architectural patterns, and context boundaries.

## Key Directives for Antigravity
1. **Context Discipline**: Load only relevant module files (<2,000 lines). Avoid reading unrelated folders.
2. **Type Safety**: Fullstack TypeScript with strict type checking. Shared schemas in `src/shared/`.
3. **Verification**: Always execute `npm run typecheck` and relevant unit tests after modifications.
4. **Clarification**: If requirements or existing patterns conflict, use the Confusion Management protocol to surface choices instead of guessing.
