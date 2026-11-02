import { test, type Page } from '@playwright/test';

/** Console errors and requests to other hosts than the site's, collected for the whole test. */
export function watch(page: Page): { errors: string[]; foreign: string[] } {
  const errors: string[] = [];
  const foreign: string[] = [];
  const site = new URL(String(test.info().project.use.baseURL)).host;
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.host !== site) foreign.push(r.url());
  });
  return { errors, foreign };
}
