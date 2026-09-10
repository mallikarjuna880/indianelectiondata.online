# Election data import specification

## Pipeline

CSV/JSON/XLSX -> staging -> schema validation -> source/provenance validation -> duplicate checks -> admin review -> publish.

## Required result fields

- election
- state
- constituency
- candidate
- party
- votes
- position
- source

## Derived values

- vote share
- winning margin
- winner flag
- turnout percentage

## Quality controls

Reject negative votes, invalid percentages, duplicate candidate/election/constituency records, missing source provenance, and impossible result ordering. Preserve corrections in audit logs rather than silently overwriting history.
