export interface TreemapInput<T> {
  data: T
  value: number
}

export interface TreemapRect<T> {
  data: T
  value: number
  x: number
  y: number
  width: number
  height: number
}

interface NormalizedNode<T> {
  data: T
  value: number
  area: number
}

function worstAspectRatio(row: NormalizedNode<unknown>[], sideLength: number): number {
  if (row.length === 0 || sideLength <= 0) return Infinity
  let sumArea = 0
  let maxArea = 0
  let minArea = Infinity

  for (const item of row) {
    sumArea += item.area
    if (item.area > maxArea) maxArea = item.area
    if (item.area < minArea) minArea = item.area
  }

  if (sumArea <= 0 || minArea <= 0) return Infinity
  const s2 = sumArea * sumArea
  const w2 = sideLength * sideLength
  return Math.max((w2 * maxArea) / s2, s2 / (w2 * minArea))
}

export function computeSquarifiedTreemap<T>(
  items: TreemapInput<T>[],
  totalWidth: number,
  totalHeight: number
): TreemapRect<T>[] {
  if (totalWidth <= 0 || totalHeight <= 0 || items.length === 0) {
    return []
  }

  const positive = items.filter((item) => Number.isFinite(item.value) && item.value > 0)
  if (positive.length === 0) return []

  positive.sort((a, b) => b.value - a.value)

  const totalValue = positive.reduce((acc, item) => acc + item.value, 0)
  if (totalValue <= 0) return []

  const totalArea = totalWidth * totalHeight
  const nodes: NormalizedNode<T>[] = positive.map((item) => ({
    data: item.data,
    value: item.value,
    area: (item.value / totalValue) * totalArea
  }))

  const results: TreemapRect<T>[] = []
  let x = 0
  let y = 0
  let w = totalWidth
  let h = totalHeight

  const layoutRow = (row: NormalizedNode<T>[]): void => {
    const rowArea = row.reduce((acc, item) => acc + item.area, 0)
    if (rowArea <= 0 || w <= 0 || h <= 0) return

    const horizontal = w >= h
    if (horizontal) {
      // Stack vertically along a strip of width = rowArea / h
      const stripWidth = Math.min(w, rowArea / h)
      let currY = y
      for (let i = 0; i < row.length; i++) {
        const node = row[i]
        const rectHeight = i === row.length - 1 ? Math.max(0, y + h - currY) : node.area / stripWidth
        results.push({
          data: node.data,
          value: node.value,
          x,
          y: currY,
          width: Math.max(0, stripWidth),
          height: Math.max(0, rectHeight)
        })
        currY += rectHeight
      }
      x += stripWidth
      w = Math.max(0, w - stripWidth)
    } else {
      // Stack horizontally along a strip of height = rowArea / w
      const stripHeight = Math.min(h, rowArea / w)
      let currX = x
      for (let i = 0; i < row.length; i++) {
        const node = row[i]
        const rectWidth = i === row.length - 1 ? Math.max(0, x + w - currX) : node.area / stripHeight
        results.push({
          data: node.data,
          value: node.value,
          x: currX,
          y,
          width: Math.max(0, rectWidth),
          height: Math.max(0, stripHeight)
        })
        currX += rectWidth
      }
      y += stripHeight
      h = Math.max(0, h - stripHeight)
    }
  }

  let currentRow: NormalizedNode<T>[] = []
  for (const node of nodes) {
    const shortSide = Math.min(w, h)
    if (shortSide <= 0) break

    if (currentRow.length === 0) {
      currentRow.push(node)
      continue
    }

    const currentWorst = worstAspectRatio(currentRow, shortSide)
    const nextWorst = worstAspectRatio([...currentRow, node], shortSide)

    if (nextWorst <= currentWorst) {
      currentRow.push(node)
    } else {
      layoutRow(currentRow)
      currentRow = [node]
    }
  }

  if (currentRow.length > 0) {
    layoutRow(currentRow)
  }

  return results
}
