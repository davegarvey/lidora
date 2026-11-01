# Standardize navigation icon sizing

Use clear, consistent Lucide icon sizes for navigation and toolbar actions, and make the For you indicator describe personalized recommendations without implying AI.

## Why

Desktop navigation and toolbar actions currently mix 14 px and 16 px icons. The For you control also uses a generic sorting icon even while recommendation-based ordering is active.

## What changes

- Set navigation and toolbar CTA icons to 16 px, while retaining smaller sizes for secondary article-row and compact inline actions.
- Show `Lightbulb` for For you and `ArrowDownWideNarrow` for Latest.
- Record the sizing convention in the contributor guidance.

## Non-goals

- Changing button hit areas or responsive layout.
- Changing ranking behavior or feed feedback.
