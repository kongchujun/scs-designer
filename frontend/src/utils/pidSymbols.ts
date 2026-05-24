/** P&ID 符号（Konva.Path），端口坐标为相对宽高的 0–1 比例 */

import type { PortLayout } from '@/utils/componentAppearance'

export interface PidSymbolDef {
  width: number
  height: number
  ports: PortLayout[]
  paths: string[]
  details?: string[]
}

function p(
  id: string,
  direction: 'in' | 'out',
  x: number,
  y: number,
  w: number,
  h: number,
  label?: string,
): PortLayout {
  return { id, direction, x: x / w, y: y / h, label }
}

const DEFAULT: PidSymbolDef = {
  width: 100,
  height: 64,
  ports: [
    { id: 'in', direction: 'in', x: 0, y: 0.5 },
    { id: 'out', direction: 'out', x: 1, y: 0.5 },
  ],
  paths: ['M 8 12 L 92 12 L 92 52 L 8 52 Z'],
}

export const PID_SYMBOLS: Record<string, PidSymbolDef> = {
  sample_probe: {
    width: 88,
    height: 72,
    ports: [p('in', 'in', 0, 36, 88, 72), p('out', 'out', 88, 36, 88, 72)],
    paths: [
      'M 44 4 L 44 18',
      'M 36 18 L 52 18 L 50 48 L 38 48 Z',
      'M 40 48 L 48 48 L 46 58 L 42 58 Z',
    ],
    details: ['M 38 24 L 50 24', 'M 39 30 L 49 30', 'M 40 36 L 48 36'],
  },
  sample_line: {
    width: 110,
    height: 48,
    ports: [p('in', 'in', 0, 28, 110, 48), p('out', 'out', 110, 28, 110, 48)],
    paths: ['M 4 28 L 106 28'],
    details: [
      'M 4 28 L 106 28',
      'M 8 16 Q 30 10 55 16 T 102 16',
      'M 8 12 L 8 20',
      'M 102 12 L 102 20',
    ],
  },
  pressure_regulator: {
    width: 72,
    height: 64,
    ports: [p('in', 'in', 0, 32, 72, 64), p('out', 'out', 72, 32, 72, 64)],
    paths: [
      'M 4 32 L 22 32',
      'M 22 14 L 50 50 L 50 14 L 22 50 Z',
      'M 50 32 L 68 32',
    ],
    details: ['M 30 22 L 42 42', 'M 42 22 L 30 42'],
  },
  coalescing_filter: {
    width: 80,
    height: 64,
    ports: [p('in', 'in', 0, 32, 80, 64), p('out', 'out', 80, 32, 80, 64)],
    paths: [
      'M 4 32 L 18 32',
      'M 18 10 L 62 54 L 62 10 L 18 54 Z',
      'M 62 32 L 76 32',
    ],
    details: ['M 28 22 L 52 42', 'M 52 22 L 28 42'],
  },
  particulate_filter: {
    width: 80,
    height: 64,
    ports: [p('in', 'in', 0, 32, 80, 64), p('out', 'out', 80, 32, 80, 64)],
    paths: [
      'M 4 32 L 16 32',
      'M 16 12 L 64 52 L 64 12 L 16 52 Z',
      'M 64 32 L 76 32',
    ],
    details: ['M 24 20 L 56 44', 'M 56 20 L 24 44', 'M 40 18 L 40 46'],
  },
  knockout_pot: {
    width: 56,
    height: 80,
    ports: [
      p('in', 'in', 0, 40, 56, 80),
      p('out', 'out', 56, 40, 56, 80),
      p('drain', 'out', 28, 80, 56, 80, 'drain'),
    ],
    paths: [
      'M 12 8 L 44 8 Q 52 8 52 20 L 52 60 Q 52 72 44 72 L 12 72 Q 4 72 4 60 L 4 20 Q 4 8 12 8 Z',
      'M 4 40 L 0 40',
      'M 52 40 L 56 40',
    ],
    details: ['M 14 50 L 42 50', 'M 28 24 L 28 36'],
  },
  heat_exchanger: {
    width: 90,
    height: 56,
    ports: [p('in', 'in', 0, 28, 90, 56), p('out', 'out', 90, 28, 90, 56)],
    paths: ['M 4 10 L 86 10 L 86 46 L 4 46 Z', 'M 4 28 L 86 28'],
    details: [
      'M 12 18 Q 25 38 40 18 T 68 18 T 82 38',
      'M 12 38 Q 25 18 40 38 T 68 38 T 82 18',
    ],
  },
  flow_meter: {
    width: 64,
    height: 64,
    ports: [p('in', 'in', 0, 32, 64, 64), p('out', 'out', 64, 32, 64, 64)],
    paths: [
      'M 4 32 L 14 32',
      'M 32 14 A 18 18 0 1 1 32 13.99 Z',
      'M 50 32 L 60 32',
    ],
    details: ['M 32 22 L 32 42', 'M 22 32 L 42 32'],
  },
  needle_valve: {
    width: 68,
    height: 56,
    ports: [p('in', 'in', 0, 28, 68, 56), p('out', 'out', 68, 28, 68, 56)],
    paths: [
      'M 4 28 L 18 28',
      'M 18 12 L 50 44 L 50 12 L 18 44 Z',
      'M 50 28 L 64 28',
      'M 34 6 L 34 16',
    ],
  },
  mfc: {
    width: 78,
    height: 64,
    ports: [p('in', 'in', 0, 32, 78, 64), p('out', 'out', 78, 32, 78, 64)],
    paths: [
      'M 4 32 L 14 32',
      'M 39 14 A 18 18 0 1 1 39 13.99 Z',
      'M 64 32 L 74 32',
    ],
    details: ['M 39 22 L 39 42', 'M 28 32 L 50 32'],
  },
  auto_switch_valve: {
    width: 80,
    height: 70,
    ports: [
      p('in', 'in', 0, 35, 80, 70),
      p('out1', 'out', 80, 20, 80, 70),
      p('out2', 'out', 80, 50, 80, 70),
    ],
    paths: [
      'M 4 35 L 28 35',
      'M 40 12 L 40 58 L 55 35 Z',
      'M 40 35 L 76 35',
      'M 55 12 L 70 22',
      'M 55 58 L 70 48',
    ],
  },
  bypass_loop: {
    width: 100,
    height: 56,
    ports: [
      p('in', 'in', 0, 40, 100, 56),
      p('out', 'out', 100, 40, 100, 56),
      p('bypass', 'out', 50, 8, 100, 56, 'bypass'),
    ],
    paths: [
      'M 4 40 L 96 40',
      'M 20 40 Q 50 4 80 40',
      'M 50 8 L 50 24',
    ],
    details: ['M 4 16 L 96 16', 'M 50 24 L 50 36'],
  },
  vent_bpr: {
    width: 76,
    height: 72,
    ports: [p('in', 'in', 0, 44, 76, 72), p('vent', 'out', 76, 44, 76, 72, 'vent')],
    paths: [
      'M 4 44 L 20 44',
      'M 20 28 L 48 60 L 48 28 L 20 60 Z',
      'M 48 44 L 64 44',
      'M 38 8 L 38 24',
      'M 30 8 L 46 8',
    ],
  },
  cal_gas_inlet: {
    width: 86,
    height: 56,
    ports: [p('cal', 'in', 0, 28, 86, 56, 'cal'), p('out', 'out', 86, 28, 86, 56)],
    paths: [
      'M 4 28 L 70 28',
      'M 70 12 L 70 44',
      'M 58 8 L 82 8 L 82 48 L 58 48 Z',
    ],
    details: ['M 62 18 L 78 18', 'M 62 28 L 78 28', 'M 62 38 L 78 38'],
  },
  analyzer_interface: {
    width: 92,
    height: 60,
    ports: [p('in', 'in', 0, 30, 92, 60), p('out', 'out', 92, 30, 92, 60)],
    paths: [
      'M 4 30 L 14 30',
      'M 14 8 L 78 8 L 78 52 L 14 52 Z',
      'M 78 30 L 88 30',
    ],
    details: [
      'M 22 18 L 70 18',
      'M 22 28 L 58 28',
      'M 22 38 L 70 38',
      'M 64 22 L 72 30 L 64 38',
    ],
  },
  three_way_valve: {
    width: 88,
    height: 88,
    ports: [
      p('in', 'in', 0, 44, 88, 88),
      p('out_a', 'out', 88, 28, 88, 88),
      p('out_b', 'out', 44, 88, 88, 88),
    ],
    paths: [
      'M 4 44 L 28 44',
      'M 44 20 L 44 68 L 68 44 Z',
      'M 44 44 L 84 28',
      'M 44 44 L 44 84',
      'M 44 16 L 52 8 L 60 16',
    ],
    details: ['M 50 12 L 58 20', 'M 58 12 L 50 20'],
  },
  three_way_tee: {
    width: 88,
    height: 88,
    ports: [
      p('in', 'in', 0, 44, 88, 88),
      p('out_a', 'out', 88, 28, 88, 88),
      p('out_b', 'out', 44, 88, 88, 88),
    ],
    paths: [
      'M 4 44 L 40 44',
      'M 40 44 L 84 28',
      'M 40 44 L 40 84',
      'M 40 20 L 40 68',
      'M 28 36 L 52 52',
      'M 52 36 L 28 52',
    ],
  },
  flow_rate_regulator: {
    width: 56,
    height: 96,
    ports: [p('in', 'in', 28, 0, 56, 96), p('out', 'out', 28, 96, 56, 96)],
    paths: [
      'M 18 8 L 38 8 L 38 72 L 18 72 Z',
      'M 28 72 L 28 88',
      'M 20 88 A 8 8 0 1 1 36 88 A 8 8 0 1 1 20 88 Z',
    ],
    details: [
      'M 22 20 L 34 20',
      'M 22 32 L 34 32',
      'M 22 44 L 34 44',
      'M 22 56 L 34 56',
      'M 24 24 L 32 48',
      'M 32 24 L 24 48',
    ],
  },
}

export function getPidSymbol(type: string): PidSymbolDef {
  return PID_SYMBOLS[type] ?? DEFAULT
}
