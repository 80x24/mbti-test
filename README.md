# mbti-test

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that takes the [16personalities.com](https://www.16personalities.com/) MBTI personality test as an AI character or persona.

Automates Chrome via Playwright CDP — the AI maps a character's personality to 60 questions, answers them automatically, and extracts the MBTI type with trait percentages.

## Install

```
claude install-skill https://github.com/80x24/mbti-test
```

## Usage

Trigger with `/mbti`, `/mbti-test`, or natural language like "take an MBTI test as my character".

### What it does

1. Launches a headless Chrome browser
2. Navigates to the 16personalities.com free test
3. AI analyzes the character's personality and maps each of the 60 questions to a -3 ~ +3 scale
4. Answers all questions automatically
5. Extracts the result: MBTI type (e.g., INTJ-T) + 5 trait percentages

### Example result

```
Type: INTJ-T (Architect)

Energy:   100% Introverted
Mind:      84% Intuitive
Nature:    77% Thinking
Tactics:   85% Judging
Identity:  63% Turbulent
```

## Requirements

- Google Chrome
- `@playwright/test` (`npm install @playwright/test`)

## Structure

```
mbti-test/
├── SKILL.md                        # Skill definition + workflow
├── scripts/mbti.mjs                # Playwright CDP automation
└── references/question-mapping.md  # 60-question dimension mapping guide
```

## License

MIT
