export default function Pagination({ count, page, pageSize = 20, hasNext, hasPrevious, onPageChange }) {
  if (count <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, count);

  return (
    <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm text-slate-500">Showing {first}–{last} of {count}</p>
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={!hasPrevious} onClick={() => onPageChange(page - 1)}>Previous</button>
        <button className="btn-secondary" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
