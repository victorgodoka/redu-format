import Link from "next/link";

/** Shared numbered pagination nav. Renders nothing when there's only one page. */
export default function Pager({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;

  return (
    <nav className="pager" aria-label="Pagination">
      {page > 1 ? (
        <Link className="pager__step" href={hrefFor(page - 1)}>
          Previous
        </Link>
      ) : (
        <span className="pager__step pager__step--off">Previous</span>
      )}

      <span className="pager__pages">
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
          n === page ? (
            <span className="pager__num pager__num--on" key={n} aria-current="page">
              {n}
            </span>
          ) : (
            <Link className="pager__num" key={n} href={hrefFor(n)}>
              {n}
            </Link>
          ),
        )}
      </span>

      {page < pages ? (
        <Link className="pager__step" href={hrefFor(page + 1)}>
          Next
        </Link>
      ) : (
        <span className="pager__step pager__step--off">Next</span>
      )}
    </nav>
  );
}
