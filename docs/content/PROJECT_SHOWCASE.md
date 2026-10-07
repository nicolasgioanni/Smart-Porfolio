# Project showcase

The Projects route presents workbook-backed project records with two local visual views. The workbook owns membership, order, copy, and external links; reviewed code owns the known-project illustration registry and workflow diagrams. No browser request goes to GitHub or the workbook. See [Content mapping](CONTENT_MAPPING.md), [Design system](../design/DESIGN_SYSTEM.md), and [Testing](../quality/TESTING.md).

## Workbook publication handoff

The import-ready file is [projects.csv](../../src/content/templates/projects.csv). It contains the unchanged canonical header and exactly five project rows:

1. `compliance-label-assistant`
2. `notepal`
3. `tergion-technologies`
4. `leetnotes`
5. `clair`

Replace only the contents of the existing workbook `projects` tab with that CSV, retaining the tab name and the other eight visible tabs. Do not add a worksheet for this guide. All five rows set `featured=false`; `detail_order` and `home_order` are 1–5, and only the first three set `show_on_home=true`. Keep `max_home_project_items=3` in `site_settings` for the intended three highlights.

The PR template snapshot already contains all five projects. Production and preview candidates select the complete public workbook, so merging this code does not replace the workbook rows. Import these rows as part of the release handoff, before the deployment candidate is generated. The existing three-row workbook remains supported but continues to show only its three rows and authored copy. This change does not write to the live workbook.

After import, verify strict remote generation in the authorized deployment candidate: five Projects cards in the order above, three Home highlights, two actions on the first three cards, and source-only actions on LeetNotes and Clair. Do not commit a remote snapshot. To roll back content, restore the previous `projects` worksheet rows and generate a fresh validated candidate; do not edit generated JSON by hand.

## Evidence and editorial boundaries

The repositories were inspected on 2026-10-05; source revisions were verified on 2026-10-07, including the current LeetNotes generation code. References describe code capabilities, not a claim that every deployed integration was exercised.

| Project | Reviewed source | Supported claims and limits |
| --- | --- | --- |
| Compliance Label Assistant | [Verification service](https://github.com/nicolasgioanni/Compliance-Label-Assistant/blob/8d939fda4c2ffa876965f8b60888cfce10b5ac08/backend/app/services/single_verification_service.py), [comparison rules](https://github.com/nicolasgioanni/Compliance-Label-Assistant/blob/8d939fda4c2ffa876965f8b60888cfce10b5ac08/backend/app/verification/rules.py), [API client](https://github.com/nicolasgioanni/Compliance-Label-Assistant/blob/8d939fda4c2ffa876965f8b60888cfce10b5ac08/frontend/src/api/verificationApi.js) | Validates and preprocesses images, extracts fields with OpenAI, and compares them with deterministic rules. Frontend queues individual verification calls. This prototype assists human review; it does not certify regulatory compliance. |
| NotePal | [Chat route](https://github.com/nicolasgioanni/NotePal/blob/3634af2c4f215a21790a22431dc00594044b3b56/app/api/chat/route.ts), [vector store](https://github.com/nicolasgioanni/NotePal/blob/3634af2c4f215a21790a22431dc00594044b3b56/lib/vector-store.ts), [media processing](https://github.com/nicolasgioanni/NotePal/blob/3634af2c4f215a21790a22431dc00594044b3b56/python-backend/note_maker.py), [attribution](https://github.com/nicolasgioanni/NotePal/blob/3634af2c4f215a21790a22431dc00594044b3b56/README.md) | Study workspace, quiz generation, history-aware retrieval, document-scoped embeddings, and separate Python media-processing code. Co-developed by Nicolas Gioanni and Parth Gupta. Do not claim sole authorship or verified end-to-end deployment of every media path. |
| Tergion Technologies | [Lead endpoint](https://github.com/Tergion/Tergion-Technologies/blob/107ae468d97366ece810f70a252f668c50568ce7/app/api/leads/route.ts), [duplicate suppression](https://github.com/Tergion/Tergion-Technologies/blob/107ae468d97366ece810f70a252f668c50568ce7/features/leads/duplicate-check.ts), [integration status](https://github.com/Tergion/Tergion-Technologies/blob/107ae468d97366ece810f70a252f668c50568ce7/README.md) | Validated inquiry and assessment intake, configured GoHighLevel contact delivery, duplicate suppression, and customer confirmation emails. The broader marketing automation examples are illustrative. |
| LeetNotes | [Generation service](https://github.com/nicolasgioanni/LeetNotes/blob/efcdbb45745d9560283f173c62302ddf082a9777/src/leetnotes/service.py), [language detection](https://github.com/nicolasgioanni/LeetNotes/blob/efcdbb45745d9560283f173c62302ddf082a9777/src/leetnotes/languages.py), [solution tests](https://github.com/nicolasgioanni/LeetNotes/blob/efcdbb45745d9560283f173c62302ddf082a9777/tests/test_solutions_sync.py), [schedule](https://github.com/nicolasgioanni/LeetNotes/blob/efcdbb45745d9560283f173c62302ddf082a9777/.github/workflows/notes.yml) | Spreadsheet-to-repository generation, metadata normalization, indexed Markdown, multiple solution languages, bounded download retries, and scheduled GitHub Actions. Searchability comes from the repository, not a custom search service. |
| Clair | [Desktop application](https://github.com/nicolasgioanni/Clair/blob/a7a485a5d36fd00b72adc233851f01447b705697/clair.py), [packaging](https://github.com/nicolasgioanni/Clair/blob/a7a485a5d36fd00b72adc233851f01447b705697/README.md) | Extension-based sorting, editable categories, saved presets, recursive scanning, optional empty-folder cleanup, and a Qt desktop interface. Do not imply AI sorting, automatic background watching, or undo support. |

The initial order prioritizes an explainable AI workflow, a broad AI study product, business integrations, developer automation, and desktop breadth. Portfolio copy must remain grounded in these capabilities; do not add unverified adoption, performance, revenue, scale, certification, or ownership claims.

The reviewed live landing pages are [Compliance Label Assistant](https://compliance-label-assistant.nicolasmgioanni.dev/), [NotePal](https://www.mynotepal.ai/), and [Tergion](https://tergion.com/). The older Compliance Vercel address returned 404 and is not used. LeetNotes and Clair have no verified web demo, so no demo action is rendered. These were landing-page checks, not authenticated or provider-backed transaction tests.

## Generated concept artwork

Five illustrations were created with the built-in image-generation tool on 2026-10-07. They are conceptual marketing visuals, not screenshots, measured results, official certification marks, or representations of a production UI. The original images were visually reviewed, then encoded as WebP at quality 86 without resizing or cropping. Exporting strips source metadata. All five files have intrinsic dimensions `1586 × 992`; together they are 293,722 bytes.

| Project | Published asset | Bytes |
| --- | --- | ---: |
| Compliance | [Concept](../../public/images/projects/compliance-label-assistant-concept.webp) | 85,278 |
| NotePal | [Concept](../../public/images/projects/notepal-concept.webp) | 60,392 |
| Tergion | [Concept](../../public/images/projects/tergion-technologies-concept.webp) | 40,512 |
| LeetNotes | [Concept](../../public/images/projects/leetnotes-concept.webp) | 55,556 |
| Clair | [Concept](../../public/images/projects/clair-concept.webp) | 51,984 |

The five `How it works` scenes are repository-native SVG/HTML diagrams with real text labels. They illustrate the supported workflows and require neither additional raster downloads nor an external rendering service.

### Prompt set

Each call used the following common direction, followed by its project-specific subject:

> Use case: stylized-concept. Asset: a polished 3D concept illustration for a software engineer's project card. Wide landscape 16:10 composition, all important objects centered inside generous safe margins so the entire scene fits in a 4:3 mobile frame. Premium editorial product illustration with softly rounded ceramic and matte polymer objects, restrained ivory, slate and muted blue palette, a small purposeful accent color, subtle natural shadows and soft studio lighting. Solid pale ivory background. Orthographic/isometric camera with clearly readable silhouettes. A finished bespoke art-directed composition, not an app screenshot. No words, letters, logos, watermarks, sparkles, glow, gradients as decoration, fake metrics, people, robot heads, or generic AI brains. Few large objects, a coherent visual story, no tiny illegible detail. Consistent family of illustrations, tactile and sophisticated.

**compliance-label-assistant**

> Subject: alcohol-label artwork on an upright paper label tile passing through a simple scanning frame. Beside it, a clean field-review board has four rows with distinct check and attention symbols, representing explainable comparison results, not a certification stamp. A tiny bottle silhouette on the label identifies its purpose. One restrained teal accent.

**notepal**

> Subject: a structured open study notebook as the focal object. Three input tiles representing a document, an image, and an audio waveform flow toward it. On the other side, one quiz card with checkboxes and one speech bubble represent practice and contextual chat. Clear spatial hierarchy, delicate violet accents.

**tergion-technologies**

> Subject: a large intake form tile connected by a short orderly path to two stacked CRM contact-record cards and a confirmation envelope. One validation checkpoint on the path, conveying reliable business inquiry handoff. Restrained navy and warm terracotta accents.

**leetnotes**

> Subject: a spreadsheet grid transforming into an organized indexed folder of study-note cards and code-file tiles, with a small circular schedule symbol. Code is represented by simple angle-bracket shapes, not written text. A logical compact pipeline composition, understated green accents.

**clair**

> Subject: a few scattered document, image and music file tiles becoming neatly sorted into three open categorized desktop folders. Before-to-after order should be immediately clear. A small settings slider object signifies customizable rules. Restrained warm amber accents.

## Visual review

See the [static-export gallery captures](../quality/evidence/projects-gallery/README.md) for the reviewed desktop and mobile views and no-JavaScript verification.

## Maintenance

When changing a record, edit the workbook or local template and regenerate through the content pipeline. When changing a visual, update the known-project registry, review both views at 320px and desktop in all palettes, retain useful alternative text and intrinsic dimensions, and update this provenance record. Unknown IDs keep their authored image and text without borrowing another project's diagram.

Use the existing action selector for Source code then Live demo, omitting absent destinations. Keep diagrams static, tab selection local, hidden panels out of keyboard navigation, and the native no-JavaScript diagram disclosure available. Keep skeleton resources aligned with the selected generated content; canonical template injection belongs only in the visual-baseline renderer.

