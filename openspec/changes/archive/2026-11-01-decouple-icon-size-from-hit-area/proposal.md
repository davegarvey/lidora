# Decouple icon size from hit area

Define icon glyph sizing independently from touch-target sizing.

## Why

The app uses different hit areas by control and context. The icon-sizing rule should establish a consistent glyph scale without imposing one hit-area size on every compact control.

## What changes

- Keep the role-based icon scale.
- State that hit areas are designed separately from icon dimensions.
- Keep the 44 px coarse-pointer requirement scoped to the sidebar heading actions in the sidebar layout spec.

## Non-goals

- Changing any hit area or icon size.
