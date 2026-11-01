import { describe, expect, it } from 'vitest';
import { DigStroke, diggable } from '../../src/input/dig';
import { N, W, cellIndex } from '../../src/sim/grid';
import { CellState, Flag, Fuel } from '../../src/sim/types';

function packedAll(fuel: number, state: number): Uint8Array {
  const p = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) p[i * 4] = fuel | (state << 3);
  return p;
}

describe('dig stroke', () => {
  it('turns a diagonal stroke into 4 connected cells in drawing order', () => {
    const stroke = new DigStroke();
    for (let k = 0; k <= 10; k++) stroke.add(10 + k, 20 + k);
    const cells = stroke.cells(packedAll(Fuel.Grass, CellState.Fuel));
    expect(cells[0]).toBe(cellIndex(10, 20));
    expect(cells[cells.length - 1]).toBe(cellIndex(20, 30));
    for (let k = 1; k < cells.length; k++) {
      const a = cells[k - 1];
      const b = cells[k];
      expect(Math.abs((a % W) - (b % W)) + Math.abs(Math.floor(a / W) - Math.floor(b / W))).toBe(1);
    }
  });

  it('ignores jitter smaller than a third of a cell', () => {
    const stroke = new DigStroke();
    expect(stroke.add(5, 5)).toBe(true);
    expect(stroke.add(5.1, 5.1)).toBe(false);
    expect(stroke.add(5.5, 5)).toBe(true);
    expect(stroke.length).toBe(2);
  });

  it('keeps only cells the crews can dig', () => {
    const packed = packedAll(Fuel.Forest, CellState.Fuel);
    const burning = cellIndex(12, 5);
    const road = cellIndex(13, 5);
    const planned = cellIndex(14, 5);
    const house = cellIndex(15, 5);
    packed[burning * 4] = Fuel.Forest | (CellState.Burning << 3);
    packed[road * 4] = Fuel.Road | (CellState.Unburnable << 3);
    packed[planned * 4 + 3] = Flag.Planned;
    packed[house * 4] = Fuel.Structure | (CellState.Fuel << 3);
    for (const c of [burning, road, planned, house]) expect(diggable(packed, c)).toBe(false);
    expect(diggable(packed, cellIndex(16, 5))).toBe(true);
    expect(diggable(null, cellIndex(16, 5))).toBe(false);
    const stroke = new DigStroke();
    stroke.add(10, 5);
    stroke.add(18, 5);
    expect(stroke.cells(packed)).toEqual([10, 11, 16, 17, 18].map((x) => cellIndex(x, 5)));
  });
});
