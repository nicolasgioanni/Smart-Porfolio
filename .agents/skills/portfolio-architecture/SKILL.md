---
name: portfolio-architecture
description: Plan or restructure Smart Portfolio modules, routes, boundaries, and documentation ownership while preserving static-first behavior.
---

# Portfolio architecture

Use this skill for system design, module moves, route ownership, shared-primitive extraction, or documentation restructuring.

Read [system decisions](../../knowledge/SYSTEM_DECISIONS.md) first. Read [Architecture](../../../docs/architecture/ARCHITECTURE.md) for a boundary or system-design decision, and [Project structure](../../../docs/architecture/PROJECT_STRUCTURE.md) only when path ownership or placement is in scope. For a behavioral change, inspect the existing component, helper, style primitive, and closest test before choosing a new abstraction.

Keep domain content near its owning feature. Move only repeated behavior into a narrow shared module with a clear owner. Preserve static rendering and progressive enhancement. When framework behavior matters, read the relevant installed Next.js guide under `node_modules/next/dist/docs/` before writing code.

Update the ownership document and its links when a path, boundary, or source of truth changes. Keep durable decisions in the compact repository memory; put implementation detail in the authoritative product document.
