/** P&ID symbol colors by component category */
const CATEGORY_COLORS: Record<string, string> = {
  取样: '#409EFF',
  处理: '#67C23A',
  测量: '#E6A23C',
  切换: '#909399',
  安全: '#F56C6C',
  分析仪: '#9B59B6',
  配管: '#00A3A3',
}

export function symbolColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#606266'
}

export function statusStroke(status: string): string {
  if (status === 'alarm') return '#F56C6C'
  if (status === 'warn') return '#E6A23C'
  return '#303133'
}
