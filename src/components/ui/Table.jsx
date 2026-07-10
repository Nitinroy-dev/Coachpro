import { TableRowSkeleton } from './Skeleton'

export default function Table({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  emptyIcon: EmptyIcon,
  onRowClick,
}) {
  if (loading) {
    return <TableRowSkeleton cols={columns.length} rows={5} />
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        {EmptyIcon && <EmptyIcon size={48} className="mb-3 opacity-40" />}
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-5 sm:-mx-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`
                  px-5 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider
                  ${col.className || ''}
                `}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              onClick={() => onRowClick?.(row)}
              className={`
                transition-colors hover:bg-gray-50/50
                ${onRowClick ? 'cursor-pointer' : ''}
              `}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={`px-5 sm:px-6 py-3.5 text-gray-700 ${col.cellClass || ''}`}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
