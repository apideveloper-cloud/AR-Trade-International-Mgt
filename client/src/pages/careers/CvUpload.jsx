/** CV drop zone, or the chosen-file row with a remove button. */
export default function CvUpload({ cv, onPick, onClear }) {
  if (cv) {
    return (
      <div className="cr-cv">
        <span className="cr-cv-ico">CV</span>
        <b className="cr-cv-name">{cv.name}</b>
        <button type="button" className="cr-cv-x" onClick={onClear}>×</button>
      </div>
    );
  }
  return (
    <label className="cr-drop">
      <span className="cr-drop-ico">⤒</span><b className="cr-drop-h">Upload your CV</b><span className="cr-drop-s">PDF or Word · max 2 MB</span>
      <input type="file" accept=".pdf,.doc,.docx" onChange={onPick} className="cr-hidden" />
    </label>
  );
}
