# Doc Guide

## Copyright

(c) Copyright 2026 Warwick Molloy.
Contribution to this project is supported and contributors will be recognised.
Created by Warwick Molloy Feb 2026.

## Format

Markdown is a text file format that should be as readable as a text file
and only made "nicer" to read when rendered as HTML or other manner.

# Principles

1. Use heading levels 1 to 4 (#) to (####) and use level 1 for new sections,
not only the title, so the title and its introduce is a new section and should have level 1 heading.

2. Space out the file around headings and between paragraphs so that
the file does not get cluttered. Place an empty line after a heading.

3. Use Mermaid for images where they add value

4. Use headings instead of **highlight**.

5. Try to format the table so it looks clear in the markdown text file.

6. Tables communicate better when a category or label is being described when the row is shorter than 60 chars.
    For long rows, use the next level 3 or heading (### or ####) with long-form text, one or more
    paragraphs below the heading, which allows for more items to be added.

7. Space out bulleted or numbered lists, so they are easier to read.

# Table example

| Category | Description          |
|----------|----------------------|
| Note 1   | make it easy to read |

... and...

# Long Form text

Using a level 4 heading gives more room for lengthier answers.


... is better than

# Labelled line

List of labelled infos:

1. **Note1:** Not easy to read as a text file.

# Purposeful Markdown

## Notes

Notes are held in the `docs/notes` directory and follow this document guide for formatting.
A note should be prefixed with the date in YYYY-MM-DD format and have a meaningful name indicating
the essential topic of the note.

## Release Notes

Release notes are held in `docs/release-notes` and follow the formatting rules in this document
guide. Their naming convention is {semver}-Release-{date}.md where "semver" means semantic versioning
with Major.Minor.Revision numbers and date is in YYYY-MM-DD format.

They should summarise key features delivered in this release, which of VecFS includes:
- significant changes in vecfs_embed 
- significant changes in the MCP server
- any new skills added.
