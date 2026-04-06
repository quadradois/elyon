# Elyon Design System — Quick Reference

## Architecture

```
tokens.json (source of truth)
    ↓ generates
tokens.css (CSS variables)
    ↓ imported by
index.css
    ↓ referenced by
tailwind.config.js (Tailwind classes)
```

## The Three Layers

| Layer | Purpose | Example |
|-------|---------|---------|
| **Primitive** | Raw values, never used directly | `--color-indigo-500: #6366f1` |
| **Semantic** | Purpose aliases | `--color-brand-primary: var(--color-indigo-500)` |
| **Component** | Per-component design | `--btn-primary-bg: var(--color-brand-primary)` |

## Tailwind Usage (New Classes)

### Brand Colors
```html
<div class="bg-brand text-white">Primary</div>
<div class="bg-brand-secondary">Secondary</div>
<div class="bg-brand-gold">Gold</div>
```

### Feedback Colors
```html
<span class="bg-success text-white">Success</span>
<span class="bg-warning text-white">Warning</span>
<span class="bg-danger text-white">Error</span>
<span class="bg-info text-white">Info</span>
```

### Surfaces & Text
```html
<div class="bg-surface-card text-text-default border border-border-default">
  Card
</div>
```

### Shadows
```html
<div class="shadow-soft">Subtle card</div>
<div class="shadow-premium hover:shadow-premium">Hover effect</div>
<div class="shadow-glow-primary">Glowing element</div>
```

### Animations
```html
<div class="animate-float">Floating element</div>
<div class="animate-fade-in">Fades in on mount</div>
<div class="animate-scale-in">Scales in</div>
<div class="animate-shimmer">Loading skeleton</div>
```

## CSS Variable Usage (Raw)

```css
.my-component {
  background: var(--btn-primary-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-premium);
  font-family: var(--font-sans);
  transition: all var(--duration-slow) var(--ease-in-out);
}
```

## Dark Mode

Dark mode is enabled via the `.dark` class on `<html>`. All semantic tokens
automatically switch — no component changes needed.

```js
// Toggle dark mode
document.documentElement.classList.toggle('dark');
```

## Adding New Tokens

1. Add values to `tokens.json` in the right layer
2. Add CSS variables to `tokens.css` under the correct `:root {}` block
3. Optionally add Tailwind aliases in `tailwind.config.js`

## Rules

1. ✅ Always reference **semantic** tokens in components
2. ✅ Use CSS variables: `var(--color-brand-primary)`
3. ✅ Use Tailwind classes: `bg-brand`, `text-text-muted`
4. ❌ Never use raw hex values (`#6366f1`) in components
5. ❌ Never reference **primitive** tokens directly in components
