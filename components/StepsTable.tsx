'use client';
import type { TestStep } from '@/utils/excelParser';
import styles from './StepsTable.module.css';

interface Props { steps: TestStep[] }

function tagAction(action: string) {
  if (!action) return <span className={styles.muted}>—</span>;
  if (action.match(/type:\$ENV:/i)) return <><span className={`${styles.tag} ${styles.tagEnv}`}>ENV</span></>;
  if (action.startsWith('type:'))   return <><span className={`${styles.tag} ${styles.tagType}`}>type</span> {action.slice(5)}</>;
  if (action === 'click')           return <span className={`${styles.tag} ${styles.tagClick}`}>click</span>;
  if (action === 'select')          return <span className={`${styles.tag} ${styles.tagSel}`}>select</span>;
  return <span className={`${styles.tag} ${styles.tagEnv}`}>{action}</span>;
}

function tagExpected(expected: string) {
  if (!expected) return <span className={styles.muted}>—</span>;
  const el = expected.toLowerCase();
  return (
    <span className={styles.expCell}>
      {(el.includes('auto forwards') || el.includes('navigates to')) && <span className={`${styles.tag} ${styles.tagAssert}`}>URL</span>}
      {el.includes('if fail goto') && <span className={`${styles.tag} ${styles.tagBranch}`}>branch</span>}
      {el.includes('ddl-includes') && <span className={`${styles.tag} ${styles.tagSel}`}>DDL</span>}
      {el.includes('displays:')    && <span className={`${styles.tag} ${styles.tagAssert}`}>assert</span>}
      <span className={styles.expText}>{expected.slice(0, 48)}{expected.length > 48 ? '…' : ''}</span>
    </span>
  );
}

export default function StepsTable({ steps }: Props) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Step</th>
            <th>Navigate to</th>
            <th>Action</th>
            <th>Web item</th>
            <th>Expected result</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.step}>
              <td className={styles.stepId}>{s.step}</td>
              <td className={styles.url}>{s.navigate || <span className={styles.muted}>—</span>}</td>
              <td>{tagAction(s.action)}</td>
              <td>{s.webItem || <span className={styles.muted}>—</span>}</td>
              <td>{tagExpected(s.expected)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
