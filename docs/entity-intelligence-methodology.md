# Entity Intelligence methodology

## Separate concepts

| Concept | Question | Existing owner |
| --- | --- | --- |
| Entity Detection | Who and what appears on the site? | Entity Intelligence |
| Entity Consistency | Do observed identity values agree? | v2 projection over Entity, Page, schema, contacts |
| Entity Authenticity | Are manipulation or synthetic-entity patterns present? | Entity Authenticity and Synthetic Entity |
| Entity Authority | Is there independent corroboration? | Citation Intelligence and connected providers |

V2 should compare brand, legal name, services, locations, email, phone, leadership, sameAs URLs, and product relationships across evidence layers. A contradiction stores both values, their sources, timestamps, and confidence. It lowers confidence and produces a diagnostic; it does not silently pick a preferred value or rewrite entity records.
