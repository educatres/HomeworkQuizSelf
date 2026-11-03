import { round } from '../../domain/scoring'
import type { Level, QuestionType, StudentExam } from '../../domain/types'
import type { StudyGrade } from './grading'

const types: Record<QuestionType, string> = { single_choice: '單選題', multiple_choice: '複選題', short_answer: '問答題' }
const levels: Record<Level, string> = { comprehension: '理解', reasoning: '推理／應用', design_tradeoff: '設計取捨' }
const colors = ['#2563eb', '#047857', '#b45309']

function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return value.replace(/[&<>"']/g, character => entities[character])
}

function distribution<T extends string>(title: string, values: T[], labels: Record<T, string>) {
  const rows = (Object.keys(labels) as T[]).map((key, index) => {
    const count = values.filter(value => value === key).length
    const share = values.length ? count / values.length * 100 : 0
    const color = colors[index]
    return `<tr><th scope="row"><span class="swatch" style="--color:${color}"></span>${labels[key]}</th>
      <td>${count}</td><td>${round(share, 1)}%</td>
      <td class="bar-cell"><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="8" fill="#e2e8f0"/>
        <rect width="${share}" height="8" fill="${color}"/>
      </svg></td></tr>`
  })
  return `<section class="distribution"><h2>${title}</h2>
    <table><thead><tr><th scope="col">分類</th><th scope="col">題數</th><th scope="col">比例</th><th scope="col">0–100%</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table></section>`
}

export function makeStudyReport(exam: StudentExam, fileName: string, grades: StudyGrade[], summary: string | undefined, demo: boolean) {
  const confirmed = grades.filter(grade => grade.earned_points !== null)
  const pending = exam.questions.length - confirmed.length
  const score = round(confirmed.reduce((total, grade) => total + (grade.earned_points ?? 0), 0))
  const max = pending ? round(confirmed.reduce((total, grade) => total + grade.max_points, 0)) : exam.total_points
  const summaryText = summary || (demo ? '離線示範未產生 AI 學習總評。'
    : pending ? '仍有題目待評，學習總評尚未產生。' : '學習總評尚未產生。')

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>作業自我練習報告</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 1.5rem auto; max-width: 52rem; padding: 0 1rem; font: 1rem/1.5 system-ui, sans-serif; color: #17252c; }
  h1 { margin-bottom: .3rem; } h2 { margin: 0 0 .65rem; font-size: 1.2rem; }
  p { margin: .35rem 0; overflow-wrap: anywhere; }
  header, section { margin-bottom: 1rem; }
  .summary { white-space: pre-wrap; }
  .charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
  .distribution { border: 1px solid #94a3b8; border-radius: .4rem; padding: .7rem; break-inside: avoid; }
  .bar-cell { width: 36%; }
  .bar-cell svg { display: block; width: 100%; height: .65rem; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th, td { border-bottom: 1px solid #cbd5e1; text-align: left; padding: .25rem; }
  .swatch { display: inline-block; width: .75em; height: .75em; margin-right: .25em; background: var(--color); border: 1px solid var(--color); }
  button { padding: .35rem .7rem; font: inherit; cursor: pointer; }
  @media screen and (max-width: 480px) { .charts { grid-template-columns: 1fr; } }
  @page { size: A4; margin: 15mm; }
  @media print {
    body { margin: 0; padding: 0; max-width: none; font-size: 10.5pt; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    button { display: none; }
    h2 { break-after: avoid; }
  }
</style>
</head>
<body>
<button type="button" onclick="window.print()">列印／另存 PDF</button>
<header><h1>作業自我練習報告</h1>
<p>作業檔案　${escapeHtml(fileName)}</p>
<p>題目共 ${exam.questions.length} 題${demo ? ' · 離線示範' : ''}</p>
<p>${pending ? '目前已確認分數' : '總分'}　${score} / ${max} 分${pending ? `（另有 ${pending} 題待評）` : ''}</p></header>
<section><h2>學習總評</h2><p class="summary">${escapeHtml(summaryText)}</p></section>
<div class="charts">
${distribution('題型配比', exam.questions.map(question => question.type), types)}
${distribution('理解層次比例分配', exam.questions.map(question => question.level), levels)}
</div>
</body>
</html>`
}

export function openStudyReport(html: string, download: boolean) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  if (download) link.download = '作業自我練習報告.html'
  else {
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  }
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
