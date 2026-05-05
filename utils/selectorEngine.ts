/**
 * Selector engine
 * Converts plain-English Web Item names into Playwright locator expressions.
 * Strategy: text-content match → ARIA role → label → placeholder → fallback.
 */

export type ActionType =
  | 'click'
  | 'type'
  | 'type-env'
  | 'select'
  | 'select-ddl'
  | 'navigate'
  | 'none';

export interface ParsedAction {
  type: ActionType;
  value: string;       // literal text or ENV key
  webItem: string;     // original web item string
  isDDL: boolean;
}

export function parseAction(action: string, webItem: string): ParsedAction {
  const a = action.trim();
  const wi = webItem.trim();

  if (!a) return { type: 'none', value: '', webItem: wi, isDDL: false };

  const envMatch = a.match(/^type:\$ENV:(\w+)$/i);
  if (envMatch) return { type: 'type-env', value: envMatch[1], webItem: wi, isDDL: false };

  const typeMatch = a.match(/^type:(.+)$/i);
  if (typeMatch) return { type: 'type', value: typeMatch[1], webItem: wi, isDDL: false };

  if (a.toLowerCase() === 'click') {
    const isDDL = wi.startsWith('DDL:');
    return { type: isDDL ? 'select-ddl' : 'click', value: isDDL ? wi.slice(4) : wi, webItem: wi, isDDL };
  }

  if (a.toLowerCase() === 'select') {
    const isDDL = wi.startsWith('DDL:');
    return { type: 'select-ddl', value: isDDL ? wi.slice(4) : wi, webItem: wi, isDDL: true };
  }

  return { type: 'none', value: a, webItem: wi, isDDL: false };
}

/**
 * Returns a Playwright locator expression string for a given web item label.
 * Uses a multi-strategy chain: text → role button → label → placeholder → name attr.
 */
export function buildLocator(webItem: string, actionType: ActionType): string {
  const safe = webItem.replace(/'/g, "\\'");

  switch (actionType) {
    case 'click':
      return (
        `page.getByText('${safe}', { exact: false })\n` +
        `    .or(page.getByRole('button', { name: '${safe}' }))\n` +
        `    .or(page.getByRole('link', { name: '${safe}' }))\n` +
        `    .or(page.getByLabel('${safe}'))\n` +
        `    .first()`
      );

    case 'select-ddl':
      return (
        `page.locator(\`[role="option"]:has-text("${safe}"), ` +
        `option:has-text("${safe}"), li:has-text("${safe}")\`).first()`
      );

    case 'type':
    case 'type-env':
      return (
        `page.getByLabel('${safe}')\n` +
        `    .or(page.getByPlaceholder('${safe}'))\n` +
        `    .or(page.locator('[name="${safe.toLowerCase()}"]'))\n` +
        `    .first()`
      );

    default:
      return `page.getByText('${safe}', { exact: false }).first()`;
  }
}

/** Parse expected result string into structured assertions */
export interface ParsedExpected {
  urlExact: string | null;
  urlPartial: string | null;
  textVisible: string | null;
  ddlIncludes: string | null;
  displays: string | null;
  formVisible: boolean;
  gotoOnFail: string | null;
  raw: string;
}

export function parseExpected(expected: string): ParsedExpected {
  const e = expected.trim();
  const el = e.toLowerCase();

  const fwd    = e.match(/auto forwards to:\s*(https?:\/\/\S+)/i);
  const nav    = e.match(/navigates to:\s*(\S+)/i);
  const disp   = e.match(/displays?:(\S+)/i);
  const ddl    = e.match(/DDL-includes?:\s*(\S+)/i);
  const goto_  = e.match(/if fail goto\s*(SPT\S+)/i);
  const login  = /login.*form|form.*appear/i.test(e);

  return {
    urlExact:    fwd  ? fwd[1]  : null,
    urlPartial:  nav  ? nav[1]  : null,
    textVisible: disp ? disp[1] : null,
    ddlIncludes: ddl  ? ddl[1]  : null,
    displays:    null,
    formVisible: login,
    gotoOnFail:  goto_ ? goto_[1] : null,
    raw: e,
  };
}
