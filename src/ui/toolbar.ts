// The toolbar on the board's near edge: tool buttons (selected, available or locked), Pause,
// and the crew line budget meter.

import { TOOL } from '../copy.js';
import { HEX } from '../render/palette.js';
import type { Tool } from '../sim/types.js';
import type { Panel } from './panels.js';

const TOOLS: Tool[] = ['dig', 'water', 'backburn'];

export class Toolbar {
  selected: Tool | null = 'dig';
  private unlocked: Tool[] = ['dig'];
  private shownLeft = -1;
  private shownTotal = -1;

  constructor(
    readonly panel: Panel,
    onPause: () => void,
  ) {
    panel.onClick('btn-pause', onPause);
    for (const tool of TOOLS) panel.onClick(`btn-${tool}`, () => this.select(tool));
    panel.setText('label-dig', TOOL.dig);
    panel.setText('label-water', TOOL.water);
    panel.setText('label-backburn', TOOL.backburn);
    panel.setText('budget-label', TOOL.budget);
    this.render();
  }

  setUnlocked(tools: Tool[]): void {
    this.unlocked = tools;
    if (this.selected && !tools.includes(this.selected)) this.selected = tools[0] ?? null;
    this.render();
  }

  private select(tool: Tool): void {
    if (!this.unlocked.includes(tool)) return;
    this.selected = tool;
    this.render();
  }

  /** Crew line left (cells), out of the day's total; `planned` is the stroke being drawn. */
  setBudget(left: number, total: number, planned = 0): void {
    const shown = Math.max(0, left - planned);
    if (shown === this.shownLeft && total === this.shownTotal) return;
    this.shownLeft = shown;
    this.shownTotal = total;
    this.panel.setText('budget-value', TOOL.km(shown));
    const pct = total > 0 ? Math.round((100 * shown) / total) : 0;
    this.panel.setProps('budget-fill', { width: `${pct}%`, display: pct > 0 ? 'flex' : 'none' });
  }

  private render(): void {
    for (const tool of TOOLS) {
      const locked = !this.unlocked.includes(tool);
      const on = this.selected === tool;
      const ink = on ? HEX.card : locked ? HEX.rule : HEX.ink;
      this.panel.setProps(`btn-${tool}`, { backgroundColor: on ? HEX.ink : HEX.board });
      this.panel.setProps(`label-${tool}`, { color: on ? HEX.card : locked ? HEX.graphite : HEX.ink });
      this.panel.setProps(`icon-${tool}`, { color: ink, display: locked ? 'none' : 'flex' });
      if (tool !== 'dig') this.panel.setProps(`lock-${tool}`, { color: HEX.graphite, display: locked ? 'flex' : 'none' });
    }
  }
}
