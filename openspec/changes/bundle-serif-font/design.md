# Design

The fonts are XCharter 1.26 from CTAN, subset with fontTools to Latin, Latin Extended, combining marks, Latin Extended Additional, general punctuation, currency, letterlike symbols, arrows, mathematical operators, box drawing, dingbats and the basic ligatures. The subset drops XCharter's private-use small capitals and old-style figures, which browsers do not use, and keeps the font name tables. Including Greek and Cyrillic would add about 55 KB, so those scripts fall back per character through `unicode-range`.

Each `@font-face` rule declares the family "XCharter", its style and weight, `font-display: swap` and the subset's `unicode-range`. The app's existing weights resolve as they do with the system Charter: 400 and 500 use the regular face, and 600 uses the bold face. The family is named "XCharter" instead of "Charter" so that it never mixes with a locally installed Charter of a different version.

The Bitstream licence permits redistribution and modification provided its notice accompanies the fonts, so `public/fonts/LICENSE-XCharter.txt` reproduces it with the XCharter copyright lines.
