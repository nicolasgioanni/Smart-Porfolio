import { useId } from "react";

export function LeetNotesPreview() {
  const titleId = useId();

  return (
    <figure aria-labelledby={titleId} className="leetnotes-preview">
      <figcaption className="visually-hidden" id={titleId}>LeetNotes turns the selected Two Sum spreadsheet row into notes and a Python solution file through a scheduled sync.</figcaption>
      <div className="leetnotes-preview__sheet">
        <div className="leetnotes-preview__sheet-heading"><span>Problems sheet</span><span>Published CSV</span></div>
        <div className="leetnotes-preview__sheet-row leetnotes-preview__sheet-row--header"><span>Problem</span><span>Approach</span><span>Language</span></div>
        <div className="leetnotes-preview__sheet-row leetnotes-preview__sheet-row--selected"><span>Two Sum</span><span>Hash map</span><span>Python</span></div>
      </div>
      <svg aria-hidden="true" className="leetnotes-preview__connector" viewBox="0 0 150 70"><path d="M8 35h106" /><path d="m100 22 18 13-18 13" /><circle cx="28" cy="35" r="5" /><circle cx="72" cy="35" r="5" /></svg>
      <div className="leetnotes-preview__files"><span className="leetnotes-preview__files-heading">Generated files</span><div className="leetnotes-preview__folder"><span>Notes/</span><code>blind75.md</code><code>neetcode150.md</code></div><div className="leetnotes-preview__folder"><span>Problems/</span><code>README.md</code><code>0001. Two Sum/<wbr />solution1.py</code></div></div>
      <div className="leetnotes-preview__sync"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 7h9l-2-2m2 2-2 2M17 17H8l2 2m-2-2 2-2" /></svg>Scheduled sync</div>
    </figure>
  );
}
