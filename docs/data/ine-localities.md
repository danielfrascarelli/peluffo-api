# INE locality catalog

Source: Uruguay's Instituto Nacional de Estadística, [Department and census locality codifiers](https://www.gub.uy/instituto-nacional-estadistica/comunicacion/publicaciones/codificadores-departamentos-localidades-censales).

Workbook: [Codificador de Departamentos y de Localidades según censos.xlsx](https://www5.ine.gub.uy/documents/CENSO%202023/Cartografia/Tablas/Codificador%20de%20Departamentos%20y%20de%20Localidades%20seg%C3%BAn%20censos.xlsx).

- Selected edition: Census 2023.
- Retrieved: 2026-10-21.
- Download SHA-256: `c304b1207cbfa9030791720a3634b62e4e5100b40bb131577606095c75df2e7b`.
- Runtime representation: `src/data/ine-localities.ts`, 19 departments and 671 distinct department/locality pairs.
- No runtime download or external geography service. No new dependency.

## Reproduce or update

1. Download the official workbook and record its checksum and retrieval date here.
2. Read `DEPARTAMENTOS_codificador`: map column A department code to column B official department name.
3. Read `LOCALIDADES_codificador censos`: take only nonempty columns A (department), B (2023 locality code), C (2023 locality name), excluding the header. Ignore historical census columns D-M and rows without a 2023 code/name.
4. Trim locality names, group by official department name and deduplicate identical department/locality pairs. Sort locality names within each department and replace the static table. Preserve names occurring in different departments; do not arbitrarily select one. `Rural` is not a unique locality and remains ambiguous.
5. Update these counts/checksum and run statistics tests, typecheck and build. Review changed mappings before deployment.

Lookup removes diacritics, folds case, trims/collapses whitespace and removes trailing periods. Only names resolving to exactly one department are accepted. Free text, comma-separated comments, absent names and cross-department collisions resolve to an unknown bucket. The lookup does not overwrite source patient data. Historical locality aliases are deliberately not imported: a former name may not have an unambiguous present-day meaning.
