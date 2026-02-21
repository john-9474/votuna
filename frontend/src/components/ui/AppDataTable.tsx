import {
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
} from '@tremor/react'
import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'

import AppButton from '@/components/ui/AppButton'
import ClearableTextInput from '@/components/ui/ClearableTextInput'
import { apiJsonOrNull } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type { UserSettings } from '@/lib/types/userSettings'

export type AppDataTableColumnMeta = {
  headerClassName?: string
  cellClassName?: string
}

type AppDataTableProps<TData> = {
  data: TData[]
  columns: Array<ColumnDef<TData, unknown>>
  emptyMessage?: string
  searchPlaceholder?: string
  itemLabel?: string
  defaultPageSize?: number
  pageSizeOptions?: number[]
  tableAriaLabel?: string
  globalFilterFn?: (row: TData, normalizedFilter: string) => boolean
}

export default function AppDataTable<TData>({
  data,
  columns,
  emptyMessage = 'No rows found.',
  searchPlaceholder = 'Search',
  itemLabel = 'rows',
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  tableAriaLabel = 'Data table',
  globalFilterFn,
}: AppDataTableProps<TData>) {
  const settingsQuery = useQuery({
    queryKey: queryKeys.userSettings,
    queryFn: () => apiJsonOrNull<UserSettings>('/api/v1/users/me/settings'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const preferredDefaultPageSize = settingsQuery.data?.default_table_page_size ?? defaultPageSize
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: preferredDefaultPageSize,
  })

  const normalizedFilter = globalFilter.trim().toLowerCase()
  const resolvedPageSizeOptions = useMemo(() => {
    const deduped = new Set(pageSizeOptions)
    deduped.add(defaultPageSize)
    deduped.add(preferredDefaultPageSize)
    return Array.from(deduped).sort((left, right) => left - right)
  }, [defaultPageSize, pageSizeOptions, preferredDefaultPageSize])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: globalFilterFn
      ? (row, _columnId, filterValue) =>
          globalFilterFn(row.original, String(filterValue || '').trim().toLowerCase())
      : 'includesString',
  })

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [normalizedFilter])

  useEffect(() => {
    setPagination((prev) =>
      prev.pageSize === preferredDefaultPageSize
        ? prev
        : { pageIndex: 0, pageSize: preferredDefaultPageSize },
    )
  }, [preferredDefaultPageSize])

  const totalCount = data.length
  const filteredCount = table.getFilteredRowModel().rows.length
  const hasFilteredRows = filteredCount > 0
  const rangeStart = hasFilteredRows ? pagination.pageIndex * pagination.pageSize + 1 : 0
  const rangeEnd = hasFilteredRows ? Math.min(rangeStart + table.getRowModel().rows.length - 1, filteredCount) : 0
  const showPaginationControls = filteredCount > pagination.pageSize

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <ClearableTextInput
            value={globalFilter}
            onValueChange={setGlobalFilter}
            placeholder={searchPlaceholder}
            clearAriaLabel="Clear table search"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
            {filteredCount === totalCount
              ? `${totalCount} total ${itemLabel}`
              : `${filteredCount} matching ${itemLabel}`}
          </Text>
          <div className="flex items-center gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
            <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">Rows per page</Text>
            <Select
              className="w-24"
              value={String(pagination.pageSize)}
              onValueChange={(value) => {
                const nextPageSize = Number(value)
                if (!Number.isFinite(nextPageSize) || nextPageSize <= 0) return
                setPagination({
                  pageIndex: 0,
                  pageSize: nextPageSize,
                })
              }}
            >
              {resolvedPageSizeOptions.map((pageSizeOption) => (
                <SelectItem key={pageSizeOption} value={String(pageSizeOption)}>
                  {pageSizeOption}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {!hasFilteredRows ? (
        <Text className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">{emptyMessage}</Text>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)]">
            <Table className="w-full table-fixed" aria-label={tableAriaLabel}>
              <TableHead className="bg-[rgba(var(--votuna-paper),0.75)]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta as AppDataTableColumnMeta | undefined
                      const sortingState = header.column.getIsSorted()
                      return (
                        <TableHeaderCell
                          key={header.id}
                          className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:rgb(var(--votuna-ink)/0.58)] ${meta?.headerClassName || ''}`.trim()}
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-[rgb(var(--votuna-ink))]"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className="text-[10px]">
                                {sortingState === 'asc' ? '^' : sortingState === 'desc' ? 'v' : ''}
                              </span>
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </TableHeaderCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody className="divide-y divide-[color:rgb(var(--votuna-ink)/0.08)]">
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as AppDataTableColumnMeta | undefined
                      return (
                        <TableCell
                          key={cell.id}
                          className={`px-4 py-3 ${meta?.cellClassName || ''}`.trim()}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
              Showing {rangeStart}-{rangeEnd} of {filteredCount} {itemLabel}
            </Text>
            {showPaginationControls ? (
              <div className="flex items-center gap-2">
                <AppButton
                  intent="ghost"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  Previous
                </AppButton>
                <AppButton
                  intent="ghost"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  Next
                </AppButton>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
