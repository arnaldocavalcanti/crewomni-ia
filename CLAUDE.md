@AGENTS.md

---

## MANDATORY STARTUP CHECKLIST

Before executing any task:

1. Read /docs/product/product-charter.md
2. Read CONTEXT.md
3. Read relevant ADRs
4. Read relevant Spec
5. Execute Superpowers Planning
6. Only then start implementation

If any step is missing:
STOP and request clarification.

---

## MANDATORY UI RULE

Before creating ANY UI file (page, component, layout — any `.tsx` that renders visual content):

1. Invoke the **frontend-designer** skill from Superpowers to define layout, spacing, typography and visual hierarchy.
2. Only implement after the design is defined.

This rule applies to ALL UI work, no exceptions.
Does NOT apply to: API routes, use-cases, tests, infrastructure, or non-visual files.
