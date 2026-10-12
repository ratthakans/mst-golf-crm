# MST Futura (licensed webfont)

Drop MST's Futura **webfont** files here (WOFF2), named by weight:

| File | Futura cut |
|---|---|
| `futura-400.woff2` | Book |
| `futura-500.woff2` | Medium |
| `futura-600.woff2` | Demi |
| `futura-700.woff2` | Bold — required, its presence switches the site to Futura |
| `futura-800.woff2` | Heavy (hero and page titles) |

The site uses Futura for titles, labels and numerals; Lato stays the body face
and Thai text keeps Kanit / Anuphan (Futura has no Thai glyphs).

Use only files MST holds a **web** licence for (a desktop licence does not cover
serving the font on a website). Fonts that come with macOS cannot be used.
After adding the files, rebuild/redeploy — the switch is decided at build time.
