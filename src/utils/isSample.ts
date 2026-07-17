import type { ERTable } from '@/types/er'

export function isSampleTable(table: ERTable): boolean {
  return table.isSample ?? false
}

export function isReadOnlyTable(table: ERTable): boolean {
  return isSampleTable(table)
}