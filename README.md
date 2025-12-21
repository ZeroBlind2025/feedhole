# FeedHole

User-configurable feed filtering for LinkedIn.

FeedHole applies pattern matching based on your preferences. It doesn't evaluate content quality—it applies rules you configure.

## How It Works

1. **MutationObserver** watches LinkedIn's infinite scroll feed
2. **Stage A rules** (local, instant) check each post against your configured filters
3. Posts matching your criteria are collapsed with a neutral explanation
4. Click "Show" to reveal any filtered post

## Default Filters

| Filter | Description |
|--------|-------------|
| Promoted content | Sponsored/promoted posts |
| Reposts | Reshared content without added commentary |
| Newsletter pitches | "Link in bio", "DM me for", lead magnet patterns |
| Engagement bait | Posts ending in "Agree?", "Thoughts?", etc. |
| Origin story hooks | "I was fired...", "I went from X to Y" patterns |
| Rage hooks | "Unpopular opinion", "Stop doing X" patterns |
| Hashtag threshold | Posts exceeding configured count (default: 5) |
| Emoji threshold | Posts exceeding configured count (default: 8) |

## Installation

### From Source (Developer Mode)

1. Clone this repository
2. Open Chrome → `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `feedhole` folder

### From Chrome Web Store

Coming soon.

## Configuration

Click the FeedHole icon → "Configure filter rules" to:

- Toggle individual filters on/off
- Adjust hashtag/emoji thresholds
- Add custom blocked phrases
- Mute specific authors

## Philosophy

FeedHole is:
- **Neutral** — Applies your preferences, doesn't judge content
- **Clinical** — Pattern matching, not content analysis
- **Fail-safe** — If anything breaks, posts display normally
- **Passive** — Never clicks, comments, or automates actions

## Privacy

- All processing happens locally in your browser
- No data is sent to external servers
- No tracking, no analytics
- Your filter preferences sync via Chrome's built-in storage (optional)

## Roadmap

- [ ] Stage B: Optional LLM scoring for ambiguous posts
- [ ] Community filter lists (subscribe to curated rulesets)
- [ ] Export/import settings
- [ ] Stats dashboard
- [ ] Firefox/Edge ports

## License

MIT

---

*"Filtered: matched 2 of your 4 active filters"*
# feedhole
