# Standardize the app icon scale

Apply one role-based icon sizing rule across the entire app so action icons have consistent visual weight.

## Why

The first pass standardized the main river and sidebar controls, but a wider review found different sizes for clickable controls in Settings, Connect, and the reader's mobile navigation.

## What changes

- Use 16 px icons for all action controls.
- Reserve 14 px for inline adornments, input hints, drag handles and status spinners; use 12 px for tiny status markers and compact inline affordances.
- Keep noninteractive swipe cues at 22 px, and size touch targets separately from their icons.
- Document the app-wide scale in contributor guidance.

## Non-goals

- Changing any control's behavior or touch target dimensions.
- Changing decorative article content or the custom Lidora brand mark.
