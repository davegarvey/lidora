## ADDED Requirements

### Requirement: Human relative times switch to absolute dates after a week

`src/util/time.ts` SHALL export `humanRelativeTime(date: Date, now?: number): string`. It SHALL return `"unknown"` for non-positive or future timestamps, `"just now"`, `"{N}m ago"`, `"{N}h ago"`, `"yesterday"` or the weekday name for dates under seven rounded days old, and otherwise the day of the month followed by the abbreviated English month (for example `"23 Oct"`), followed by the four-digit year when the date's local year differs from the local year of `now`. It SHALL NOT return month-relative labels such as `"last month"`.

#### Scenario: Older date in the current year
- **WHEN** `humanRelativeTime` is called with a date 8 days before `now` in the same year
- **THEN** the result SHALL be the day and abbreviated month, such as `"23 Oct"`

#### Scenario: Date in an earlier year
- **WHEN** `humanRelativeTime` is called with 30 December 2025 and `now` in 2026
- **THEN** the result SHALL be `"30 Dec 2025"`

#### Scenario: Recent date under a week old
- **WHEN** `humanRelativeTime` is called with a date four days before `now`
- **THEN** the result SHALL be that date's weekday name

### Requirement: Reader byline exposes the exact publication time

The reading view byline SHALL render the publication date inside a `<time>` element whose `datetime` attribute is the ISO 8601 timestamp and whose `title` attribute is the full local date and time.

#### Scenario: Hovering the byline date
- **WHEN** the reader shows an article published at 17:56 on 23 October 2026
- **THEN** the byline date SHALL be a `<time>` element with `datetime` set to that instant in ISO 8601 and a `title` containing the full date and time
