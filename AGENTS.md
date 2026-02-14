# Agent Instructions for VecFS

This document provides essential guidelines for AI agents and LLMs contributing to the VecFS project. It ensures consistency across the codebase, documentation, and overall system architecture.

# Code Standards and Design

VecFS follows modern software engineering best practices to ensure the system remains maintainable and extensible.

## SOLID Principles

All source code should adhere to the SOLID principles:
- **Single Responsibility:** Each class or module should have one reason to change.
- **Open/Closed:** Entities should be open for extension but closed for modification.
- **Liskov Substitution:** Derived types must be substitutable for their base types.
- **Interface Segregation:** Clients should not be forced to depend on methods they do not use.
- **Dependency Inversion:** Depend on abstractions, not concretions.

## File Organization

- **Source Location:** All TypeScript source code must be placed in the `ts-src/` directory to accommodate potential multi-language support in the future.
- **Length:** Source files should generally be between 50 and 300 lines.
- **Preference:** More short, focused files are preferred over fewer large, monolithic ones.
- **Naming:** Use clear, descriptive names for files and symbols that reflect their specific responsibility.

# Documentation and Notes

Documentation is a first-class citizen in VecFS.

## Structure

- **Core Docs:** All primary documentation (requirements, goals, skills) is located in `docs/`.
- **Exploratory Notes:** Ideas, research, and implementation plans are stored in `docs/notes/` and should be prefixed with the current date (e.g., `YYYY-MM-DD-topic.md`).

## Formatting Rules

All Markdown files must follow the guidelines in `docs/doc-guide.md`, specifically:
- Use `#` (Level 1 headings) for all new sections, including the document title.
- Place an empty line after every heading.
- Use headings instead of bold text for labels or categories.
- Avoid wide tables; use headings and paragraphs for descriptions longer than 60 characters.
- Use `mermaid` for diagrams, ensuring all text labels are quoted.

# Workflow and Contributions

When proposing new features or architectural changes:

## Implementation Planning

1. Create a new implementation plan in `docs/notes/` prefixed with today's date.
2. Review the plan against the core goals in `docs/goals.md` and requirements in `docs/requirements.md`.
3. Update existing documentation if the change introduces new core behaviors or skills.

## MCP Integration

Ensure that any new tools or resources exposed by the MCP server are documented in `docs/requirements.md` and that their usage patterns are reflected in `docs/skills.md`.
