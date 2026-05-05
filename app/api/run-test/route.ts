import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

const TMP_DIR = join(process.cwd(), 'tmp', 'playwright-run');

export async function POST(req: NextRequest) {
  try {
    const { code, browser, headless } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'No code provided.' }, { status: 400 });
    }

    // Write generated code to tmp file
    mkdirSync(TMP_DIR, { recursive: true });
    const testFile = join(TMP_DIR, 'jt4-run.spec.ts');
    writeFileSync(testFile, code, 'utf8');

    // Build playwright CLI args
    const args = [
      'playwright', 'test',
      testFile,
      '--reporter=list',
      `--project=${browser ?? 'chromium'}`,
    ];
    if (headless === false) args.push('--headed');

    // Spawn and collect output — use streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const proc = spawn('npx', args, {
          cwd: process.cwd(),
          env: { ...process.env },
          shell: true,
        });

        const send = (line: string) => {
          controller.enqueue(encoder.encode(line + '\n'));
        };

        send('[JT4] Starting Playwright execution...');
        send(`[JT4] File: ${testFile}`);
        send(`[JT4] Args: npx ${args.join(' ')}`);
        send('');

        proc.stdout.on('data', (d: Buffer) => {
          d.toString().split('\n').forEach((l: string) => { if (l.trim()) send(l); });
        });

        proc.stderr.on('data', (d: Buffer) => {
          d.toString().split('\n').forEach((l: string) => { if (l.trim()) send('[ERR] ' + l); });
        });

        proc.on('close', (code: number) => {
          send('');
          send(code === 0
            ? '[JT4] ✓ Test run completed successfully.'
            : `[JT4] ✗ Test run exited with code ${code}.`
          );
          controller.close();
        });

        proc.on('error', (err: Error) => {
          send('[JT4] Process error: ' + err.message);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
