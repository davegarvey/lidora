# Align clickable row icon sizing

Use one desktop icon size for clickable navigation, toolbar and row actions, while keeping noninteractive indicators compact.

## Why

The first icon-sizing rule left clickable article and feed row actions at 14 px, even though other desktop actions use 16 px. These controls are all interactive and should have the same visual weight.

## What changes

- Set clickable row action icons to 16 px.
- Reserve 14 px for noninteractive status and drag icons, and 12 px for compact inline affordances.
- Update the contributor guidance and UI icon-sizing specification.

## Non-goals

- Changing button hit areas, layout or action behavior.
