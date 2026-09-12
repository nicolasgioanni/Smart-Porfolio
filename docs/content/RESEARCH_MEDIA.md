# Research media

This guide records publication facts and integrity contracts for checked-in Research media. It complements the content schema and does not assign rights that are not documented with the supplied asset.

## CytoCV supplementary video S1

The following files are published together from `public/images/research/`:

- `cytocv-supplementary-video-s1.mp4`
- `cytocv-supplementary-video-s1.en.vtt`
- `cytocv-supplementary-video-s1-transcript.txt`

The MP4 is a portfolio-owner-supplied CytoCV supplementary video for publication in this portfolio. It contains no embedded authorship or license metadata, so no separate media license is asserted. Its provenance state is `not-separately-specified`; do not infer that a source-code license applies to this media or make an ownership or copyright claim.

The file is intentionally kept byte-for-byte as supplied: 14,938,147 bytes; SHA-256 `8cb4dbbc23556826de641be434e7c04b30796c87691e0166c0510a2af74ca143`; ISO MP4 with H.264/AVC (`avc1`) video at 1710 by 1108 pixels and 25 fps, plus stereo AAC (`mp4a`) audio at 48 kHz; 328.440 seconds. Do not transcode or replace it without renewed publication authorization and a matching review of the accessibility files.

The source includes narrated scientific information. The checked-in English WebVTT has 85 non-overlapping cues from 00:00:00.430 through 00:05:27.380, and the text transcript preserves the same time-coded narration plus timestamped visual descriptions of essential on-screen information. A direct source review checked the narration timeline with local speech recognition, waveform activity, and representative frames for the microscopy comparison, analysis settings, results, export choices, spreadsheet, and final graph. That review split the source's processing pause into a cue ending at 00:02:20.580 and a resumed phrase from 00:02:27.780 through 00:02:29.370, rather than displaying one caption throughout the silence. The visual descriptions distinguish what is shown from what is spoken and retain the source labels DIC, DAPI, Nup2-mKATE, Stu2-GFP, CSV, and Excel. Both files are UTF-8 with LF-only line endings, enforced by their path-specific `.gitattributes` rules. Their SHA-256 values are `86a1c264126eee49143abc3ffbb411f753232b3c64053cf7f533a8efce61104b` and `0182483a8a72aeba8712e5319e62a477e933a6843471509218621e231951dc8e`, respectively.

## Publication and replacement checks

`src/lib/media/researchVideoAssets.test.ts` opens and stats each asset before allocating its read buffer, rejects growth or truncation during the bounded read, and parses the required ISO boxes without relying on an external executable in continuous integration. It locks byte size, SHA-256, movie and track durations, stream sample entries, dimensions, LF-only accessibility-file bytes, complete caption structure, cue timing, visual-description content, and transcript hashes. The deterministic parser rejects malformed headers and applies a 16 MiB video ceiling, a 64 KiB ceiling to each accessibility text asset, 4,096 parsed boxes, and eight levels of required-box traversal. Run that test before changing any of the three files.

The player accepts only resolver-owned root-relative paths under `/images/research/`; it uses native controls, an enabled captions track, and a compact in-player toolbar with labelled transcript, MP4-download, and enlarged-player controls. The transcript remains a direct text-resource link and the MP4 control retains the native `download` attribute. Its resolver record also owns the concise display title shown above the player, while the project title remains in the accessible player and dialog names. The enlarged player keeps its transcript and download controls in the same toolbar while its close control remains independently visible. A replacement must retain those properties, update the resolver record and asset contract together, and be reviewed at desktop and mobile modal sizes.

Graphical-abstract resolver records likewise own their compact display titles. Known curated projects use their reviewed labels; an unfamiliar valid canonical abstract receives the neutral `Graphical Abstract` label. The title does not replace the project heading, image alternative text, or preview/dialog accessible names.

## Graphical abstract framing

Inline graphical abstracts use a fixed 16px, top-aligned frame inset that fills the available visual column. The local solid, rounded frame clips its own visual content, while the image uses `object-fit: contain` so it is neither cropped nor stretched. Keep this inline geometry aligned with the Research loading skeleton; the modal preview continues to preserve the full image independently.
