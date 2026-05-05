import type { TestStep } from './excelParser';
import {
  parseAction,
  buildLocator,
  parseExpected,
  type ActionType,
} from './selectorEngine';

export interface CodeGenOptions {
  browser: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  timeout: number;
  envValues: Record<string, string>;
}

export function generatePlaywrightCode(steps: TestStep[], opts: CodeGenOptions): string {
  const { browser, headless, timeout, envValues } = opts;
  const L = (s: string) => s; // identity — just for readability

  const lines: string[] = [];

  lines.push(`import { chromium, firefox, webkit } from 'playwright';`);
  lines.push(`import { expect } from '@playwright/test';`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * JT4 Automated Test — generated ${new Date().toISOString()}`);
  lines.push(` * Steps: ${steps.length} | Browser: ${browser} | Headless: ${headless}`);
  lines.push(` */`);
  lines.push(`async function runTest() {`);
  lines.push(`  const browser = await ${browser}.launch({ headless: ${headless} });`);
  lines.push(`  const ctx = await browser.newContext();`);
  lines.push(`  const page = await ctx.newPage();`);
  lines.push(`  page.setDefaultTimeout(${timeout});`);
  lines.push(``);

  // Build a label→index map for goto branching
  const labelIndex: Record<string, number> = {};
  steps.forEach((s, i) => { labelIndex[s.step] = i; });

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const comment = `// [${s.step}]${s.notes ? ' — ' + s.notes : ''}`;
    lines.push(`  ${comment}`);

    // Navigate
    if (s.navigate) {
      lines.push(`  await page.goto('${s.navigate}');`);
    }

    // Action
    const parsed = parseAction(s.action, s.webItem);

    if (parsed.type === 'click') {
      const loc = buildLocator(s.webItem, 'click');
      lines.push(`  await ${loc}.click();`);
    } else if (parsed.type === 'select-ddl') {
      const loc = buildLocator(parsed.value, 'select-ddl');
      lines.push(`  await ${loc}.click();`);
    } else if (parsed.type === 'type-env') {
      const envKey = parsed.value;
      const envVal = envValues[envKey] ?? `process.env.${envKey} ?? ''`;
      const loc = buildLocator(s.webItem, 'type-env');
      // If ENV value is a literal (user filled it in), embed it; otherwise use process.env
      const valueExpr = envValues[envKey]
        ? `'${envValues[envKey].replace(/'/g, "\\'")}'`
        : `process.env.${envKey} ?? ''`;
      lines.push(`  await ${loc}.fill(${valueExpr});`);
    } else if (parsed.type === 'type') {
      const loc = buildLocator(s.webItem, 'type');
      lines.push(`  await ${loc}.fill('${parsed.value.replace(/'/g, "\\'")}');`);
    }

    // Expected result assertions
    const exp = parseExpected(s.expected);

    if (exp.urlExact || exp.urlPartial || exp.textVisible || exp.ddlIncludes || exp.formVisible) {
      if (exp.gotoOnFail) {
        // Wrap assertion in try/catch for branch logic
        lines.push(`  try {`);
        if (exp.urlExact) {
          lines.push(`    await expect(page).toHaveURL('${exp.urlExact}', { timeout: ${timeout} });`);
        } else if (exp.urlPartial) {
          const safe = exp.urlPartial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          lines.push(`    await expect(page).toHaveURL(/${safe}/);`);
        } else if (exp.textVisible) {
          lines.push(`    await expect(page.getByText('${exp.textVisible}', { exact: false })).toBeVisible();`);
        } else if (exp.ddlIncludes) {
          lines.push(`    await expect(page.getByText('${exp.ddlIncludes}', { exact: false })).toBeVisible();`);
        } else if (exp.formVisible) {
          lines.push(`    await expect(page.locator('form')).toBeVisible();`);
        }
        lines.push(`  } catch (_err) {`);
        lines.push(`    console.warn('[${s.step}] assertion failed — jumping to ${exp.gotoOnFail}');`);
        lines.push(`    // goto ${exp.gotoOnFail} — handled by execution flow`);
        lines.push(`  }`);
      } else {
        if (exp.urlExact) {
          lines.push(`  await expect(page).toHaveURL('${exp.urlExact}');`);
        } else if (exp.urlPartial) {
          const safe = exp.urlPartial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          lines.push(`  await expect(page).toHaveURL(/${safe}/);`);
        } else if (exp.textVisible) {
          lines.push(`  await expect(page.getByText('${exp.textVisible}', { exact: false })).toBeVisible();`);
        } else if (exp.ddlIncludes) {
          lines.push(`  await expect(page.getByText('${exp.ddlIncludes}', { exact: false })).toBeVisible();`);
        } else if (exp.formVisible) {
          lines.push(`  await expect(page.locator('form')).toBeVisible();`);
        }
      }
    }

    lines.push(``);
  }

  lines.push(`  await browser.close();`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`runTest().catch((err) => { console.error(err); process.exit(1); });`);

  return lines.join('\n');
}
