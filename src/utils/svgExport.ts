import { toSvg, toPng } from 'html-to-image'

const REACT_FLOW_SELECTOR = '.react-flow'

function getFlowElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(REACT_FLOW_SELECTOR)
}

function exportFilter(node: Node): boolean {
  if (node instanceof HTMLElement) {
    if (node.closest('.react-flow__minimap')) return false
    if (node.closest('.react-flow__controls')) return false
    if (node.closest('.react-flow__attribution')) return false
    if (node.classList.contains('react-flow__background')) return false
    // 导出时去除 React Flow 容器自带的灰底网格，使背景变为纯色
    if (node.classList.contains('react-flow__container')) {
      node.style.backgroundColor = 'transparent'
      node.style.backgroundImage = 'none'
    }
  }
  return true
}

const EXPORT_OPTIONS = {
  backgroundColor: '#ffffff',
  filter: exportFilter,
  skipAutoScale: true,
  pixelRatio: 2,
} as const

function dispatchFitView(): void {
  window.dispatchEvent(new CustomEvent('erbeauti:fit-view-instant'))
}

/**
 * 等待 React Flow 完成重绘：确保 fitView 的视口变换以及
 * onlyRenderVisibleElements 切换后的所有节点都已渲染到 DOM。
 */
function waitForRender(ms = 150): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, ms)
      })
    })
  })
}

export async function exportAsSvgXml(): Promise<string> {
  const el = getFlowElement()
  if (!el) throw new Error('未找到画布元素')
  // 先等待所有节点渲染并测量完成（导出前会设置 exporting=true 以关闭 onlyRenderVisibleElements）
  await waitForRender(200)
  dispatchFitView()
  // 再等待 fitView 的视口变换生效
  await waitForRender(120)
  const dataUrl = await toSvg(el, EXPORT_OPTIONS)
  const res = await fetch(dataUrl)
  return res.text()
}

export async function exportAsPngBlob(): Promise<Blob> {
  const el = getFlowElement()
  if (!el) throw new Error('未找到画布元素')
  await waitForRender(200)
  dispatchFitView()
  await waitForRender(120)
  const rect = el.getBoundingClientRect()
  const dataUrl = await toPng(el, {
    ...EXPORT_OPTIONS,
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
  })
  const res = await fetch(dataUrl)
  return res.blob()
}
