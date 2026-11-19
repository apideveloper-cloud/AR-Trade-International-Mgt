import './lists.css';

/** Shared shell for the wishlist and compare pages: wrapper plus title and subtitle. */
export default function ListPage({ title, sub, children }) {
  return (
    <section className="wsl-page">
      <div className="wsl-head">
        <h1 className="wsl-h1">{title}</h1>
        <span className="wsl-sub">{sub}</span>
      </div>
      {children}
    </section>
  );
}
