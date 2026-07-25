Project: nest-backend

Stack
- NestJS 11
- TypeORM
- PostgreSQL
- pnpm

Architecture
- Core
- Infrastructure
- Features

Imports
- @core/*
- @features/*
- @infrastructure/*

Tests
- Unit
- E2E

Commands
pnpm lint
pnpm test
pnpm test:e2e

Patterns
- Services contain business logic
- Controllers stay thin
- Use DTO validation
- Use transactions where required
- Never use relative imports across modules