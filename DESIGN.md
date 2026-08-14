# 网络流量分析监测管控软件 Design Checklist

This project uses `design-system/MASTER.md` as the global source of truth.

## Audit Priority

1. Accessibility: contrast, visible focus, labels, keyboard order, aria labels.
2. Touch and interaction: 44px minimum targets, 8px spacing, clear disabled/loading states.
3. Performance: stable layouts, reduced layout shift, modest effects.
4. Style selection: security operations console with high-signal controls.
5. Layout and responsive: 375px viewport must not create page-level horizontal scroll.
6. Typography and color: semantic tokens, readable 16px body text, tabular numbers for metrics.
7. Animation: short state transitions and `prefers-reduced-motion` support.
8. Forms and feedback: visible labels, inline recovery copy, submit feedback.
9. Navigation: role-aware menus and predictable mobile drawer behavior.
10. Charts and data: legends, labels, and text summaries must accompany color.

## Current Product Direction

Network traffic analysis, alert handling, policy control, audit, user management, and reporting console for security operations.

## Implementation Notes

- Keep the product name as `网络流量分析监测管控软件`.
- Keep login-before-data access and role-aware navigation.
- Avoid color-only severity communication; pair tones with labels or numbers.
- Every new control must have visible focus, disabled semantics when unavailable, and a touch target of at least 44px.
