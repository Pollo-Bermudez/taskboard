# Taskboard Architecture

## Overview
Taskboard is a fullstack web application for organizing, tracking, and prioritizing tasks across columns/statuses.

```
┌────────────────────────────────────────────────────────┐
│                      Client (SPA)                      │
│            React + TypeScript + Tailwind CSS           │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / JSON
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Server (Node.js API)                 │
│              Express / Fastify + TypeScript            │
└───────────────────────────┬────────────────────────────┘
                            │ Shared Contract
                            ▼
┌────────────────────────────────────────────────────────┐
│                      Shared Layer                      │
│             TypeScript Interfaces + Zod Schemas        │
└────────────────────────────────────────────────────────┘
```

## Core Principles
1. **End-to-End Type Safety**: Shared TypeScript interfaces and Zod schemas ensure API contracts remain synchronized between client and server.
2. **Context Modularity**: Backend, frontend, and shared modules are cleanly separated to minimize AI context footprint during focused tasks.
3. **Deterministic Testing**: Colocate unit tests with source files; verify client components with testing-library and API routes with integration tests.
4. **Predictable State & Errors**: Explicit error responses with standardized status codes and informative payloads.
