## ADDED Requirements

### Requirement: Serif font is bundled

The serif font stack SHALL begin with a bundled copy of the Charter typeface, served by the application, so that serif text renders in the same typeface on every platform. The bundled font SHALL be available offline once the application has been installed or visited.

#### Scenario: Serif text on a platform without Charter

- **WHEN** the application is opened on a platform that does not provide Charter
- **THEN** the wordmark, article text, article titles and other serif text SHALL render in the bundled Charter typeface

#### Scenario: Serif text offline

- **WHEN** the application is opened offline after a previous visit
- **THEN** serif text SHALL render in the bundled Charter typeface

## MODIFIED Requirements

### Requirement: Brand elements are unaffected

The sidebar wordmark, collapsed brand mark, and mobile topbar wordmark SHALL always render in the serif font stack regardless of the reading font preference.

#### Scenario: Brand mark stays serif when reading font is sans-serif

- **WHEN** the user selects "Sans-serif" for the reading font
- **THEN** the "lidora" wordmark in the sidebar SHALL remain in the serif font stack
