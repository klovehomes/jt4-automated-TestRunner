import * as XLSX from 'xlsx';

export interface TestStep {
  step: string;
  navigate: string;
  action: string;
  webItem: string;
  expected: string;
  notes: string;
}

const COL_KEYS: Record<string, string[]> = {
  step:     ['step', 'spt', 'step #', 'step#'],
  navigate: ['navigate to', 'navigate', 'url', 'go to'],
  action:   ['action'],
  webitem:  ['web item', 'webitem', 'element', 'field'],
  expected: ['expected result', 'expected', 'result'],
  notes:    ['notes', 'note', 'comment'],
};

function matchCol(header: string): string | null {
  const h = header.toLowerCase().trim();
  for (const [key, variants] of Object.entries(COL_KEYS)) {
    if (variants.some((v) => h.includes(v))) return key;
  }
  return null;
}

export function parseExcelBuffer(buffer: ArrayBuffer): TestStep[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  if (rows.length < 2) throw new Error('File has no data rows.');

  const headers = rows[0].map(String);
  const cm: Record<string, number> = {};
  headers.forEach((h, i) => {
    const k = matchCol(h);
    if (k) cm[k] = i;
  });

  if (cm.step === undefined && cm.action === undefined) {
    throw new Error('Could not find required columns. Verify your header row.');
  }

  const steps: TestStep[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const stepId = String(row[cm.step] ?? '').trim();
    if (!stepId) continue;
    steps.push({
      step:     stepId,
      navigate: String(row[cm.navigate] ?? '').trim(),
      action:   String(row[cm.action]   ?? '').trim(),
      webItem:  String(row[cm.webitem]  ?? '').trim(),
      expected: String(row[cm.expected] ?? '').trim(),
      notes:    String(row[cm.notes]    ?? '').trim(),
    });
  }

  if (!steps.length) throw new Error('No data rows found after the header.');
  return steps;
}

export function extractEnvVars(steps: TestStep[]): string[] {
  const vars = new Set<string>();
  steps.forEach((s) => {
    const m = s.action.match(/type:\$ENV:(\w+)/i);
    if (m) vars.add(m[1]);
  });
  return Array.from(vars);
}
