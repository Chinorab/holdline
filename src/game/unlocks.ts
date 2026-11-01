// Tools unlock by fires played, not by calendar days. Day 0 is fire 1 (dig line), the next
// completed fire adds the water drop, the one after adds the backburn. Daily and practice
// fires both count. Each new tool is introduced once.

import type { Tool } from '../sim/types.js';

/** Tools available for the next fire, given how many fires were completed before it. */
export function toolsFor(completedFires: number): Tool[] {
  if (completedFires <= 0) return ['dig'];
  if (completedFires === 1) return ['dig', 'water'];
  return ['dig', 'water', 'backburn'];
}

/** The tool to introduce at the start of this fire, if any (once per tool, in unlock order). */
export function introFor(tools: Tool[], introsShown: Partial<Record<Tool, boolean>>): Tool | null {
  for (const tool of ['water', 'backburn'] as const) {
    if (tools.includes(tool) && !introsShown[tool]) return tool;
  }
  return null;
}
