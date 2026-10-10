import type React from 'react';
interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
}

export function AdminTable<T extends { id: string }>({
  title,
  description,
  columns,
  rows,
}: {
  title: string;
  description: string;
  columns: Array<TableColumn<T>>;
  rows: T[];
}) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d]">
      <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          {rows.length} registros
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="p-5">
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm text-[var(--color-text-secondary)]">
            Sin registros disponibles desde la fuente actual.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="px-5 py-3 font-semibold"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-5 py-4 text-[var(--color-text-secondary)]"
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
