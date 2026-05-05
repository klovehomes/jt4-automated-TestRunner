'use client';
import { useState, useRef, useCallback } from 'react';
import { parseExcelBuffer, extractEnvVars, type TestStep } from '@/utils/excelParser';
import { generatePlaywrightCode } from '@/utils/codeGenerator';
import StepsTable from './StepsTable';
import styles from './TestRunner.module.css';

interface RunStat { total: number; passed: number; failed: number; skipped: number; }

export default function TestRunner() {
  const [steps, setSteps]           = useState<TestStep[]>([]);
  const [envVarKeys, setEnvVarKeys] = useState<string[]>([]);
  const [envValues, setEnvValues]   = useState<Record<string, string>>({});
  const [code, setCode]             = useState('');
  const [fileName, setFileName]     = useState('');
  const [uploadErr, setUploadErr]   = useState('');

  const [browser, setBrowser]   = useState<'chromium'|'firefox'|'webkit'>('chromium');
  const [headless, setHeadless] = useState(true);
  const [timeout, setTimeout_]  = useState(15000);

  const [running, setRunning]   = useState(false);
  const [logLines, setLogLines] = useState<{ text: string; type: string }[]>([
    { text: 'Waiting for test run…', type: 'muted' },
  ]);
  const [stats, setStats]       = useState<RunStat>({ total: 0, passed: 0, failed: 0, skipped: 0 });

  const consoleRef = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);

  const scrollConsole = () => {
    setTimeout(() => {
      if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }, 50);
  };

  const addLine = (text: string, type = 'muted') => {
    setLogLines((prev) => [...prev, { text, type }]);
    scrollConsole();
  };

  async function handleFile(file: File) {
    setUploadErr('');
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseExcelBuffer(buf);
      const keys   = extractEnvVars(parsed);
      setSteps(parsed);
      setEnvVarKeys(keys);
      setFileName(file.name);
      rebuildCode(parsed, keys, envValues, browser, headless, timeout);
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    }
  }

  function rebuildCode(
    s: TestStep[],
    keys: string[],
    ev: Record<string, string>,
    br: string,
    hl: boolean,
    to: number,
  ) {
    const generated = generatePlaywrightCode(s, {
      browser: br as 'chromium'|'firefox'|'webkit',
      headless: hl,
      timeout: to,
      envValues: ev,
    });
    setCode(generated);
  }

  function onEnvChange(key: string, val: string) {
    const next = { ...envValues, [key]: val };
    setEnvValues(next);
    rebuildCode(steps, envVarKeys, next, browser, headless, timeout);
  }

  function onBrowserChange(v: 'chromium'|'firefox'|'webkit') {
    setBrowser(v);
    rebuildCode(steps, envVarKeys, envValues, v, headless, timeout);
  }

  function onHeadlessChange(v: boolean) {
    setHeadless(v);
    rebuildCode(steps, envVarKeys, envValues, browser, v, timeout);
  }

  function onTimeoutChange(v: number) {
    setTimeout_(v);
    rebuildCode(steps, envVarKeys, envValues, browser, headless, v);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [envValues, browser, headless, timeout]);

  async function runTest() {
    if (!code.trim()) return;
    setRunning(true);
    setLogLines([]);
    setStats({ total: steps.length, passed: 0, failed: 0, skipped: 0 });

    try {
      const res = await fetch('/api/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, browser, headless }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let passed = 0, failed = 0, skipped = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        chunk.split('\n').forEach((line) => {
          if (!line.trim()) return;
          let type = 'muted';
          if (line.includes('✓') || line.includes('passed')) { type = 'pass'; passed++; }
          else if (line.includes('✗') || line.includes('failed') || line.includes('[ERR]')) { type = 'fail'; failed++; }
          else if (line.includes('warn') || line.includes('jumping')) type = 'warn';
          else if (line.startsWith('[JT4]')) type = 'info';
          addLine(line, type);
        });
        setStats({ total: steps.length, passed, failed, skipped });
      }
    } catch (err: unknown) {
      addLine('Connection error: ' + (err instanceof Error ? err.message : String(err)), 'fail');
    } finally {
      setRunning(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(code).catch(() => {});
  }

  function downloadCode() {
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jt4-test.spec.ts';
    a.click();
  }

  function downloadReport() {
    const text = logLines.map((l) => l.text).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jt4-report.txt';
    a.click();
  }

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" stroke="#4f8ef7" strokeWidth="1.5"/>
          <polygon points="7,5.5 13.5,9 7,12.5" fill="#3ecf8e"/>
        </svg>
        <h1>JT4 Automated Test Runner</h1>
        <span className={styles.badge}>Playwright · Excel-driven</span>
      </header>

      {/* Top row: upload left, editor right */}
      <div className={styles.topRow}>

        {/* LEFT: Upload + steps + ENV */}
        <div className={styles.card}>
          <p className={styles.cardLabel}>Test steps — Excel upload</p>

          <div
            className={styles.dropZone}
            onClick={() => fileRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            {fileName
              ? <p className={styles.fileName}>{fileName} — {steps.length} steps</p>
              : <p>Click or drag &amp; drop your Excel file</p>
            }
            <small>Columns: Step · Navigate To · Action · Web Item · Expected Result · Notes</small>
          </div>

          {uploadErr && <p className={styles.uploadErr}>{uploadErr}</p>}

          {steps.length > 0 && <StepsTable steps={steps} />}

          {envVarKeys.length > 0 && (
            <div className={styles.envSection}>
              <p className={styles.cardLabel} style={{ marginBottom: 8 }}>ENV variables</p>
              <div className={styles.envGrid}>
                {envVarKeys.map((k) => (
                  <div key={k} className={styles.envItem}>
                    <label>{k}</label>
                    <input
                      type="text"
                      placeholder={`value for ${k}`}
                      value={envValues[k] ?? ''}
                      onChange={(e) => onEnvChange(k, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Code editor + run controls */}
        <div className={styles.card}>
          <p className={styles.cardLabel}>Generated Playwright script — editable</p>

          {code ? (
            <textarea
              className={styles.codeEditor}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <div className={styles.codePlaceholder}>
              Upload an Excel file to generate the test script.
            </div>
          )}

          <div className={styles.runBar}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={headless}
                onChange={(e) => onHeadlessChange(e.target.checked)}
              />
              Headless
            </label>

            <label className={styles.selectLabel}>
              Browser
              <select value={browser} onChange={(e) => onBrowserChange(e.target.value as 'chromium'|'firefox'|'webkit')}>
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit</option>
              </select>
            </label>

            <label className={styles.selectLabel}>
              Timeout
              <select value={timeout} onChange={(e) => onTimeoutChange(Number(e.target.value))}>
                <option value={10000}>10 s</option>
                <option value={15000}>15 s</option>
                <option value={30000}>30 s</option>
                <option value={60000}>60 s</option>
              </select>
            </label>

            <div className={styles.runBtns}>
              <button className={styles.btnSm} onClick={copyCode} disabled={!code}>Copy</button>
              <button className={styles.btnSm} onClick={downloadCode} disabled={!code}>Download</button>
              <button
                className={`${styles.btnRun} ${running ? styles.btnRunning : ''}`}
                onClick={runTest}
                disabled={!code || running}
              >
                {running ? '⏳ Running…' : '▶ Run test'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Results console */}
      <div className={styles.resultsSection}>
        <div className={styles.resultsHeader}>
          <span>Test results</span>
          <div className={styles.statsRow}>
            <span className={styles.statTotal}>{stats.total} steps</span>
            <span className={styles.statPass}>{stats.passed} passed</span>
            <span className={styles.statFail}>{stats.failed} failed</span>
            <span className={styles.statSkip}>{stats.skipped} skipped</span>
            <button className={styles.btnSm} onClick={downloadReport}>Download report</button>
          </div>
        </div>
        <div className={styles.console} ref={consoleRef}>
          {logLines.map((l, i) => (
            <div key={i} className={`${styles.logLine} ${styles['log_' + l.type]}`}>
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
