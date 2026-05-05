import { NextRequest, NextResponse } from 'next/server';
import { generatePlaywrightCode } from '@/utils/codeGenerator';
import type { TestStep } from '@/utils/excelParser';
import type { CodeGenOptions } from '@/utils/codeGenerator';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const steps: TestStep[] = body.steps;
    const opts: CodeGenOptions = {
      browser:   body.browser   ?? 'chromium',
      headless:  body.headless  ?? true,
      timeout:   body.timeout   ?? 15000,
      envValues: body.envValues ?? {},
    };

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: 'No steps provided.' }, { status: 400 });
    }

    const code = generatePlaywrightCode(steps, opts);
    return NextResponse.json({ code });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
