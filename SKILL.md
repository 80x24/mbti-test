---
name: mbti-test
description: >
  Take the 16personalities.com MBTI personality test as an AI character or persona.
  Automates browser via Playwright CDP — answers 60 questions based on character personality,
  then extracts the result (MBTI type + trait percentages).
  Use when: "/mbti", "/mbti-test", "MBTI", "take MBTI", "personality test", "16personalities",
  "MBTI 검사", "성격 검사", "take personality test as character"
---

# MBTI Test Automation

Take the 16personalities.com MBTI test as any character or persona using Playwright CDP.

## Prerequisites

- `@playwright/test` installed (check with `npm ls @playwright/test`)
- Google Chrome installed

## Skill Root

`~/.claude/skills/mbti-test/`

## Flow

### Step 1: Define Character Personality

Determine who is taking the test. Sources:
- User-provided character description
- Character config file (e.g., influgent `characters/{name}/config.json`)
- AI agent's own personality (from IDENTITY.md, SOUL.md, etc.)

Identify the target MBTI dimensions:
- **I/E**: Introverted vs Extraverted
- **N/S**: Intuitive vs Observant
- **T/F**: Thinking vs Feeling
- **J/P**: Judging vs Prospecting
- **A/T**: Assertive vs Turbulent

### Step 2: Launch Browser

```bash
node ~/.claude/skills/mbti-test/scripts/mbti.mjs start          # headless
node ~/.claude/skills/mbti-test/scripts/mbti.mjs start --headed  # with GUI
```

### Step 3: Build Answer Mapping

Read [references/question-mapping.md](references/question-mapping.md) for the full question list and dimension mapping guide.

Create a JSON file at `/tmp/mbti-answers.json` mapping each of the 60 questions to a value from -3 to 3:

```json
{
  "You regularly make new friends.": 2,
  "Complex and novel ideas excite you more than simple and straightforward ones.": -3,
  "__gender": "Female"
}
```

Scale: -3 (Strongly Agree) → 0 (Neutral) → 3 (Strongly Disagree)

**Critical**: Read each question's FULL text carefully. Many questions are negatively worded (e.g., "pondering philosophy is a WASTE" — an intuitive character should DISAGREE, not agree).

Add `__gender` key with "Male", "Female", or "Other" for the avatar selection.

### Step 4: Run Test

```bash
node ~/.claude/skills/mbti-test/scripts/mbti.mjs answer /tmp/mbti-answers.json
```

Output: JSON with MBTI type, trait percentages, and description. Screenshot at `/tmp/mbti-result.png`.

### Step 5: Show Results

1. Read `/tmp/mbti-result.png` to display result visually
2. Parse the JSON output for type and percentages
3. Offer to save results (e.g., to a character config or markdown file)

### Step 6: Cleanup

```bash
node ~/.claude/skills/mbti-test/scripts/mbti.mjs stop
```

## Utility Commands

```bash
# Extract all 60 questions (useful if questions change)
node ~/.claude/skills/mbti-test/scripts/mbti.mjs extract

# Get result from current page (if browser still open on result page)
node ~/.claude/skills/mbti-test/scripts/mbti.mjs result
```

## Environment

- CDP port: 9333 (override with `MBTI_CDP_PORT`)
- PID file: `/tmp/mbti-session.pid`
- Chrome profile: `/tmp/mbti-chrome-profile`
- Screenshot: `/tmp/mbti-result.png`
