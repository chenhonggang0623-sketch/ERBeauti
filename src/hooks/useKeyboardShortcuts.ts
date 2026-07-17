import { useEffect } from 'react'
import { useERStore } from '@/store/erStore'

/**
 * 全局键盘快捷键监听。
 * - Delete：删除选中表
 * - Ctrl+Z / Ctrl+Shift+Z：撤销 / 重做
 * - Ctrl+Shift+F：适应画布
 */
export function useKeyboardShortcuts() {
  const deleteTable = useERStore((state) => state.deleteTable)
  const undo = useERStore((state) => state.undo)
  const redo = useERStore((state) => state.redo)
  const selectedTableId = useERStore((state) => state.selectedTableId)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 跳过长按重复触发
      if (event.repeat) return

      const isMeta = event.metaKey || event.ctrlKey

      // 撤销 / 重做
      if (isMeta && event.key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      // 适应画布
      if (isMeta && event.shiftKey && event.key === 'F') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('erbeauti:fit-view'))
        return
      }

      // 删除选中表
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedTableId) {
          // 避免在输入框中误删
          const target = event.target as HTMLElement
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return
          }
          event.preventDefault()
          deleteTable(selectedTableId)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [deleteTable, undo, redo, selectedTableId])
}
