# Research media

This guide records publication facts and integrity contracts for checked-in Research media. It complements the content schema and does not assign rights that are not documented with the supplied asset.

## CytoCV supplementary video S1

The following files are published together from `public/images/research/`:

- `cytocv-supplementary-video-s1.mp4`
- `cytocv-supplementary-video-s1.en.vtt`
- `cytocv-supplementary-video-s1-transcript.txt`

The MP4 is a portfolio-owner-supplied CytoCV supplementary video for publication in this portfolio. It contains no embedded authorship or license metadata, so no separate media license is asserted. Its provenance state is `not-separately-specified`; do not infer that a source-code license applies to this media or make an ownership or copyright claim.

The file is intentionally kept byte-for-byte as supplied: 14,938,147 bytes; SHA-256 `8cb4dbbc23556826de641be434e7c04b30796c87691e0166c0510a2af74ca143`; ISO MP4 with H.264/AVC (`avc1`) video at 1710 by 1108 pixels and 25 fps, plus stereo AAC (`mp4a`) audio at 48 kHz; 328.440 seconds. Do not transcode or replace it without renewed publication authorization and a matching review of the accessibility files.

The source includes narrated scientific information. The checked-in English WebVTT has 84 non-overlapping cues from 00:00:00.430 through 00:05:27.380, and the text transcript preserves the same time-coded narration. Their SHA-256 values are `ff138aefd1d420d160322bc9c39328b3212220827a23b57b3c30226e1083ce8f` and `309d98221f512e91430b1ed70c990c7ae6816f31e2ac89f295cfa957d8d30f1a`, respectively. Preserve reviewed terminology including CytoCV, DIC, DAPI, Nup2-mKATE, Stu2-GFP, CSV, and Excel.

## Publication and replacement checks

`src/lib/media/researchVideoAssets.test.ts` parses the required ISO MP4 boxes without relying on an external executable in continuous integration. It locks byte size, SHA-256, movie and track durations, stream sample entries, dimensions, caption structure, cue timing, and transcript hashes. Run that test before changing any of the three files.

The player accepts only resolver-owned root-relative paths under `/images/research/`; it uses native controls, an enabled captions track, a readable transcript link, and an explicit MP4 download fallback. A replacement must retain those properties, update the resolver record and asset contract together, and be reviewed at desktop and mobile modal sizes.
