import { AssetType, defineAssets } from '@iwsdk/core';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
  priority: 'lazy' as const,
});

// Panels are spawned at runtime by the game (src/ui/panels.ts); they are listed here so
// the editor and the IWSDK UI tools can preview them.
export default defineAssets({
  'briefing-panel': uikitml('briefing.uikitml', 'Briefing'),
  'strip-panel': uikitml('strip.uikitml', 'Instruction strip'),
  'toolbar-panel': uikitml('toolbar.uikitml', 'Toolbar'),
  'pause-panel': uikitml('pause.uikitml', 'Pause'),
  'about-panel': uikitml('about.uikitml', 'About'),
  'result-panel': uikitml('result.uikitml', 'Result'),
  'inspect-panel': uikitml('inspect.uikitml', 'Inspect'),
  'journal-panel': uikitml('journal.uikitml', 'Journal'),
  'captions-panel': uikitml('captions.uikitml', 'Captions'),
  'settings-panel': uikitml('settings.uikitml', 'Settings'),
  'edge-panel': uikitml('edge.uikitml', 'Board edge controls'),
});
