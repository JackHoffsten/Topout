# Issue tracker: GitHub

Issues and specs live in GitHub Issues for JackHoffsten/Topout.
Use the gh CLI from this clone.

## Operations

- Create: gh issue create --title "..." --body-file <file>
- Read: gh issue view <number> --json number,title,body,labels,comments
- List: gh issue list --state open --json number,title,body,labels
- Comment: gh issue comment <number> --body-file <file>
- Label: gh issue edit <number> --add-label "<label>"
- Remove label: gh issue edit <number> --remove-label "<label>"
- Close: gh issue close <number>

For multiline bodies, write the text to a temporary file and use
--body-file.

Publishing to the issue tracker means creating a GitHub issue.
Fetching a relevant ticket means reading its GitHub issue.

## Pull requests as a triage surface

PRs as a request surface: no.

## Wayfinding

Keep the map in an issue labelled wayfinder:map. Link child tickets
as sub-issues, or use a task list plus "Part of #<map>" in each child.
Use wayfinder:research, wayfinder:prototype, wayfinder:grilling, or
wayfinder:task labels.

Represent blockers with native GitHub issue dependencies when
available; otherwise use "Blocked by: #<number>" in the ticket body.
A ticket is eligible when its blockers are closed and it is unassigned.
Choose the first eligible ticket in map order.

Claim by assigning the ticket to the driving developer. Resolve by
commenting with the result, closing the ticket, and adding a summary
and link to the map's Decisions-so-far.
