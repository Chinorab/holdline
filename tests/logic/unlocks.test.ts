import { describe, expect, it } from 'vitest';
import { introFor, toolsFor } from '../../src/game/unlocks';

describe('unlocks by fires played', () => {
  it('Day 0 is fire 1 with the dig line only', () => {
    expect(toolsFor(0)).toEqual(['dig']);
  });

  it('adds the water drop after one completed fire and the backburn after two', () => {
    expect(toolsFor(1)).toEqual(['dig', 'water']);
    expect(toolsFor(2)).toEqual(['dig', 'water', 'backburn']);
    expect(toolsFor(9)).toEqual(['dig', 'water', 'backburn']);
  });

  it('counts practice fires like daily ones (the counter does not care)', () => {
    // A first sitting: Day 0, then a practice fire, then today's fire has every tool.
    let completed = 0;
    completed++; // Day 0
    expect(toolsFor(completed)).toContain('water');
    completed++; // a practice fire
    expect(toolsFor(completed)).toContain('backburn');
  });

  it('introduces each new tool once, in unlock order', () => {
    expect(introFor(['dig'], {})).toBeNull();
    expect(introFor(['dig', 'water'], {})).toBe('water');
    expect(introFor(['dig', 'water'], { water: true })).toBeNull();
    expect(introFor(['dig', 'water', 'backburn'], {})).toBe('water');
    expect(introFor(['dig', 'water', 'backburn'], { water: true })).toBe('backburn');
    expect(introFor(['dig', 'water', 'backburn'], { water: true, backburn: true })).toBeNull();
  });
});
