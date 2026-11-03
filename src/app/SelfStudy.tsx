import { makeStudyReport, openStudyReport } from '../features/self-study/report'
import { readStudyPlan, StudyPlanPanel } from './StudyPlanPanel'
import { EXAMPLE_BUTTONS, EXAMPLE_SETS, type ExampleKind } from '../features/examples/assignments'
import { useEffect, useRef, useState } from 'react'
import { round } from '../domain/scoring'
import { DEFAULT_PLAN, type QuizBundle, type SourceDocument } from '../domain/types'
import { initialGrades, makeSubmission, gradeWritten, explainStudyAnswer, needsStudyFeedback, studyFeedback, summarizeStudy, type StudyGrade } from '../features/self-study/grading'
import { makeDemoBundle } from '../features/quiz-generation/mockGeneration'
import { generateExamWithProvider } from '../features/quiz-generation/pipeline'
import { extensionOf, parseFile, SUPPORTED_EXTENSIONS } from '../parsers/text'
import { deleteRecord, getRecord, putRecord } from '../persistence/indexedDb'
import { DEFAULT_BASE_URLS, GOOGLE_DEFAULT_MODEL, type AppProvider } from '../persistence/localSettings'
import { providerFor } from '../providers/api-tests'
import { CGU_ALLOWED_MODELS, CGU_DEFAULT_MODEL } from '../providers/cguModels'
import { classifyProviderError, type ModelInfo } from '../providers/types'
import logo from '../../logo.png'
import '../styles.css'
import './selfStudy.css'

const providers: Record<AppProvider, string> = {
  google: 'Google AI Studio', cgu: 'CGU', openai: 'OpenAI（尚未開放）', xai: 'Grok（尚未開放）', mock: '離線示範',
}
const defaults: Record<AppProvider, string> = {
  google: GOOGLE_DEFAULT_MODEL, cgu: CGU_DEFAULT_MODEL, openai: '', xai: '', mock: '',
}
const studyPlanKey = 'aihwq.selfStudy.plan.v1'
const settingsKey = 'aihwq.selfStudy.settings.v1'
const keyName = 'aihwq.selfStudy.key.v1'
const sessionId = 'self-study-active'
const maxFileBytes = 10 * 1024 * 1024

function readStorage(key: string) {
  try { return localStorage.getItem(key) ?? '' } catch { return '' }
}

function isEnabledProvider(provider: unknown): provider is 'google' | 'cgu' | 'mock' {
  return provider === 'google' || provider === 'cgu' || provider === 'mock'
}

function readConnection() {
  try {
    const saved: { provider?: unknown; model?: unknown } | null = JSON.parse(readStorage(settingsKey))
    if (isEnabledProvider(saved?.provider) && typeof saved.model === 'string') {
      const provider = saved.provider
      const model = saved.model.trim()
      return { provider, model: provider === 'cgu' && !CGU_ALLOWED_MODELS.some(id => id === model) ? CGU_DEFAULT_MODEL : model || defaults[provider] }
    }
  } catch { /* start with the default */ }
  return { provider: 'google' as AppProvider, model: GOOGLE_DEFAULT_MODEL }
}

function readRememberedKey() {
  try {
    const saved: { provider?: unknown; model?: unknown } | null = JSON.parse(readStorage(settingsKey))
    if (isEnabledProvider(saved?.provider) && saved.provider !== 'mock') return readStorage(keyName)
  } catch { /* ignore settings that cannot be restored */ }
  return ''
}

type Study = {
  source: SourceDocument
  example?: ExampleKind
  bundle?: QuizBundle
  demo?: boolean
  answers: Record<string, string | string[]>
  grades?: StudyGrade[]
  summary?: string
}

const questionLabels = { single_choice: '單選', multiple_choice: '複選', short_answer: '問答' }

export default function SelfStudy() {
  const [connection, setConnection] = useState(readConnection)
  const [apiKey, setApiKey] = useState(readRememberedKey)
  const [remember, setRemember] = useState(() => Boolean(apiKey))
  const [models, setModels] = useState<ModelInfo[]>([])
  const [studyPlan, setStudyPlan] = useState(() => {
    try { return readStudyPlan(JSON.parse(readStorage(studyPlanKey))) }
    catch { return readStudyPlan(DEFAULT_PLAN) }
  })
  const [study, setStudy] = useState<Study>()
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('')
  const analysisDialog = useRef<HTMLDialogElement>(null)
  const [notice, setNotice] = useState('')
  const [storageWarning, setStorageWarning] = useState('')
  const writes = useRef(Promise.resolve())
  const action = useRef(false)
  const provider = connection.provider
  const exam = study?.bundle?.exam
  const grades = study?.grades
  const pending = grades?.filter(grade => grade.earned_points === null).length ?? 0
  const missingFeedback = grades?.some((grade, index) => exam && needsStudyFeedback(grade, exam.questions[index].type)) ?? false
  const canConnect = provider === 'mock' || Boolean(apiKey.trim() && connection.model.trim())

  useEffect(() => {
    let active = true
    getRecord<{ id: string; study: Study }>('jobs', sessionId).then(saved => {
      if (active) setStudy(saved?.study)
    }).catch(() => {
      if (active) setStorageWarning('瀏覽器儲存不可用，請保持本頁開啟。')
    }).finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!loaded) return
    writes.current = writes.current.then(async () => {
      if (study) await putRecord('jobs', { id: sessionId, study })
      else await deleteRecord('jobs', sessionId)
    }).catch(() => setStorageWarning('儲存練習失敗，請保持本頁開啟。'))
  }, [study, loaded])

  useEffect(() => {
    try {
      localStorage.setItem(settingsKey, JSON.stringify(connection))
      if (remember && apiKey) localStorage.setItem(keyName, apiKey)
      else localStorage.removeItem(keyName)
    } catch { setStorageWarning('無法儲存 AI 設定，請保持本頁開啟。') }
  }, [connection, apiKey, remember])

  useEffect(() => {
    try { localStorage.setItem(studyPlanKey, JSON.stringify(studyPlan)) }
    catch { setStorageWarning('無法儲存命題設定，請保持本頁開啟。') }
  }, [studyPlan])

  useEffect(() => {
    const dialog = analysisDialog.current
    if (!dialog) return
    if (analyzing && !dialog.open) dialog.showModal()
    if (!analyzing && dialog.open) dialog.close()
  }, [analyzing])

  function client() {
    return providerFor({ provider, apiKey: apiKey.trim(), model: connection.model.trim(), baseUrl: DEFAULT_BASE_URLS[provider] })
  }

  function errorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof TypeError || /cors|failed to fetch|network/i.test(message)) {
      return '瀏覽器無法連到供應商。可能是網路中斷或供應商的 CORS 限制。'
    }
    return apiKey.trim() ? classifyProviderError(error).replaceAll(apiKey.trim(), '[已隱藏]') : classifyProviderError(error)
  }

  async function run(label: string, work: () => Promise<void>, lockScreen = false) {
    if (action.current || !loaded) return
    action.current = true
    setBusy(label)
    setAnalyzing(lockScreen)
    setNotice('')
    try { await work() } catch (error) { setNotice(errorMessage(error)) }
    finally { action.current = false; setBusy(''); setAnalyzing(false) }
  }

  async function selectFile(files: FileList | null) {
    if (!files?.length || study) return
    const file = files[0]
    await run('解析作業中…', async () => {
      if (files.length !== 1) throw new Error('一次只能上傳一份作業。')
      if (file.size > maxFileBytes) throw new Error('檔案大小上限為 10 MiB。')
      if (!SUPPORTED_EXTENSIONS.includes(extensionOf(file.name))) throw new Error('不支援這種檔案格式。')
      const source = await parseFile(file)
      if (source.needs_review || !source.blocks.length) throw new Error(source.warnings.join(' ') || '檔案沒有可擷取的內容。')
      setStudy({ source, answers: {} })
    })
  }

  async function loadExample(kind: ExampleKind) {
    if (study?.example === kind) return
    if (study && !window.confirm('載入範例會取代目前的練習，確定要繼續嗎？')) return
    await run('載入範例中…', async () => {
      const example = EXAMPLE_SETS[kind]
      const [sample] = example.students
      const file = new File([sample.text], `${sample.id}_assignment.${example.extension}`)
      const source = await parseFile(file)
      setStudy({ source, example: kind, answers: {} })
      setNotice('已載入範例。準備好後可按「產生練習」。')
    })
  }

  async function generate() {
    if (!study || study.bundle || !canConnect) return
    await run('AI 正在準備題目與批改參考…', async () => {
      const example = study.example ? EXAMPLE_SETS[study.example] : undefined
      const plan = {
        ...DEFAULT_PLAN,
        ...studyPlan,
        batch_id: crypto.randomUUID(),
        course_title: example?.course_title ?? '作業自我練習',
        assignment_title: example?.assignment_title ?? '我的作業',
      }
      const demo = provider === 'mock'
      const bundle = demo ? await makeDemoBundle(study.source, plan, 'self')
        : await generateExamWithProvider(study.source, plan, 'self', client(), (completed, total) => setBusy(`出題中（${completed}/${total}）…`))
      setStudy({ ...study, bundle, demo })
    }, provider !== 'mock')
  }

  async function grade() {
    if (!study?.bundle || (!study.demo && (!canConnect || provider === 'mock'))) return
    const { bundle } = study
    await run('批改中…', async () => {
      const submission = makeSubmission(bundle, study.answers)
      const next = [...(study.grades ?? initialGrades(bundle, submission))]
      const ai = study.demo ? undefined : client()
      setStudy({ ...study, grades: next })
      for (const [index, row] of next.entries()) {
        const question = bundle.exam.questions[index]
        if (needsStudyFeedback(row, question.type)) {
          if (!ai) continue
          setBusy(`產生 ${row.question_id} 的理解評語…`)
          try {
            next[index] = { ...row, understanding_feedback: await explainStudyAnswer(bundle, submission, row, ai) }
            setStudy({ ...study, grades: [...next] })
          } catch (error) {
            setNotice(`部分逐題評語未能產生，可重試。${errorMessage(error)}`)
          }
          continue
        }
        if (row.earned_points !== null) continue
        setBusy(`批改 ${row.question_id}…`)
        try { next[index] = await gradeWritten(bundle, submission, row, ai) }
        catch (error) {
          next[index] = { ...row, earned_points: null, review_required: true, feedback: `暫無可靠評分。${errorMessage(error)}` }
        }
        setStudy({ ...study, grades: [...next] })
      }
      if (ai && next.every((row, index) => row.earned_points !== null && !needsStudyFeedback(row, bundle.exam.questions[index].type))) {
        setBusy('產生學習總評…')
        try {
          const summary = await summarizeStudy(next, ai)
          setStudy({ ...study, grades: next, summary })
        } catch (error) {
          setNotice(`總評產生失敗。${errorMessage(error)}`)
        }
      }
    }, !study.demo)
  }

  function exportReport(download: boolean) {
    if (!study?.bundle || !exam || !grades) return
    openStudyReport(makeStudyReport(exam, study.bundle.key, study.source.file_name, study.answers, grades, study.summary, Boolean(study.demo)), download)
  }

  function answer(questionId: string, value: string | string[]) {
    setStudy(current => current && !current.grades ? { ...current, answers: { ...current.answers, [questionId]: value } } : current)
  }

  const disabled = Boolean(busy) || !loaded
  const activeKey = provider !== 'mock'
  return <main className="study-shell">
    <header className="study-header">
      <img src={logo} alt="" />
      <div><h1>作業自我練習</h1><p>上傳一份作業，作答後查看批改與學習回饋。</p></div>
    </header>
    <section className="panel study-panel">
      <h2>1. 連接 AI</h2>
      <fieldset disabled={disabled} className="study-fields">
        <label className="field"><span>AI 供應商</span><select value={provider} onChange={e => {
          const next = e.target.value
          if (!isEnabledProvider(next)) return
          setConnection({ provider: next, model: defaults[next] })
          setApiKey(''); setRemember(false); setModels([]); setNotice(''); setConnectionStatus('')
        }}>{Object.entries(providers).map(([id, name]) => <option key={id} value={id} disabled={!isEnabledProvider(id)}>{name}</option>)}</select></label>
        {activeKey && <>
          <label className="field"><span>API Key</span><input type="password" value={apiKey} autoComplete="off" onChange={e => { setApiKey(e.target.value); setConnection({ provider, model: defaults[provider] }); setModels([]); setNotice(''); setConnectionStatus('') }} /></label>
          {models.length > 0 && <label className="field"><span>模型</span>
            <select value={connection.model} onChange={e => { setConnection({ provider, model: e.target.value }); setConnectionStatus('') }}>
              {models.map(model => <option key={model.id} value={model.id}>{model.displayName}（{model.id}）</option>)}
            </select>
          </label>}
          <label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> 記住金鑰（儲存在此瀏覽器，同源程式可讀取）</label>
          <div className="study-actions">
            <button type="button" className="ghost-button" disabled={!apiKey.trim()} onClick={() => void run('讀取模型中…', async () => {
              setConnectionStatus('')
              const ai = client()
              const available = await ai.listModels?.() ?? []
              const visible = provider === 'cgu' ? available.filter(model => CGU_ALLOWED_MODELS.some(id => id === model.id)) : available
              setModels(visible)
              if (!visible.some(model => model.id === connection.model)) setConnection({ provider, model: visible[0]?.id ?? defaults[provider] })
              setNotice(visible.length ? `已讀取 ${visible.length} 個模型。可在模型欄選擇。` : '連線可達，但未列出可選模型。')
            })}>讀取模型</button>
            <button type="button" className="ghost-button" disabled={!canConnect} onClick={() => void run('測試連線中…', async () => {
              setConnectionStatus('測試連線中…')
              try {
                await client().complete('請只回覆 OK。', '只回覆 OK。')
                setConnectionStatus('模型連線測試成功。')
              } catch (error) {
                setConnectionStatus(`測試失敗。${errorMessage(error)}`)
              }
            })}>測試連線</button>
            <button type="button" className="ghost-button" onClick={() => { setApiKey(''); setRemember(false); setConnection({ provider, model: defaults[provider] }); setModels([]); setNotice(''); setConnectionStatus('') }}>清除 API Key</button>
          </div>
          {provider === 'google' && <a href="./google-ai-studio-api-key-guide.html" target="_blank" rel="noreferrer">Google AI Studio 金鑰申請指南</a>}
          <p className="study-connection-status" role="status">{connectionStatus}</p>
        </>}
      </fieldset>
      <p className="muted">檔案由此瀏覽器解析。AI 出題與批改會將必要的作業文字及答案傳給所選供應商。金鑰預設只在本頁使用。</p>
    </section>
    <section className="panel study-panel">
      <h2>2. 上傳作業並出題</h2>
      <div className="study-examples">
        <h3>內建作業範例</h3>
        <p>點選一份即可載入，適合試用或課堂示範。想先練習操作，可在上方選擇「離線示範」。</p>
        <div className="study-actions">
          {EXAMPLE_BUTTONS.map(({ kind, label }) => (
            <button type="button" className={study?.example === kind ? 'primary-button' : 'ghost-button'}
              key={kind} disabled={disabled || study?.example === kind} onClick={() => void loadExample(kind)}>
              {study?.example === kind ? `已載入 ${label}` : label}
            </button>
          ))}
        </div>
      </div>
      {study ? <>
        <p>{study.example ? EXAMPLE_SETS[study.example].assignment_title + ' · ' : ''}{study.source.file_name}</p>
        {study.example && <details><summary>查看範例內容</summary><pre className="study-example-text">{study.source.text}</pre></details>}
        {study.source.warnings.map(warning => <p className="muted" key={warning}>{warning}</p>)}
        <div className="study-actions">
          <button className="ghost-button" disabled={disabled} onClick={() => {
            if (window.confirm('清除本次練習的作業、題目、答案及批改結果？')) { setStudy(undefined); setNotice('') }
          }}>清除練習</button>
        </div>
      </> : <div className="dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void selectFile(e.dataTransfer.files) }}>
        <label className="field"><span>選擇或拖曳一份作業（可選字 PDF、文字、Notebook 或程式碼，最多 10 MiB）</span>
          <input type="file" disabled={disabled} accept={SUPPORTED_EXTENSIONS.map(ext => '.' + ext).join(',')} onChange={e => { void selectFile(e.target.files); e.target.value = '' }} />
        </label>
      </div>}
    </section>
    <section className="panel study-panel">
      <h2>3. 題型配比與理解層次</h2>
      <StudyPlanPanel plan={studyPlan} setPlan={setStudyPlan} disabled={disabled} />
      {!exam ? <button className="primary-button" disabled={disabled || !study || !canConnect} onClick={() => void generate()}>產生練習</button>
        : <p className="muted">變更會套用到下一次出題。</p>}
    </section>
    <div className="study-status" role="status" aria-live="polite">{[busy, notice, storageWarning].filter(Boolean).join(' ')}</div>
    {exam && <section className="panel study-panel">
      <h2>4. 作答與批改 {study.demo && <small>（離線示範）</small>}</h2>
      <form onSubmit={e => {
        e.preventDefault()
        if (!grades && !window.confirm('確認送出批改？送出後這次作答會鎖定。')) return
        void grade()
      }}>
        {exam.questions.map((question, index) => {
          const id = question.question_id
          const value = study.answers[id]
          const result = grades?.find(row => row.question_id === id)
          const reference = result ? study.bundle?.key.questions.find(row => row.question_id === id) : undefined
          return <fieldset className="study-question" key={id}>
            <legend>第 {index + 1} 題 · {questionLabels[question.type]} · {question.points} 分</legend>
            <p>{question.question}</p>
            {question.type === 'short_answer'
              ? <textarea aria-label={`第 ${index + 1} 題作答`} rows={4} maxLength={10000} readOnly={Boolean(grades)} value={typeof value === 'string' ? value : ''} onChange={e => answer(id, e.target.value)} />
              : question.options?.map(option => {
                const multiple = question.type === 'multiple_choice'
                const selected = Array.isArray(value) ? value : []
                return <label className="study-option" key={option.id}><input type={multiple ? 'checkbox' : 'radio'} name={id} disabled={Boolean(grades)} checked={multiple ? selected.includes(option.id) : value === option.id} onChange={e => answer(id, multiple ? (e.target.checked ? [...selected, option.id] : selected.filter(item => item !== option.id)) : option.id)} /> {option.id}. {option.text}</label>
              })}
            {result && <div className="study-feedback">
              <strong>{result.earned_points === null ? '待評' : `${result.earned_points} / ${result.max_points} 分`}</strong>
              {result.earned_points === null && <p>這題尚無可靠分數。</p>}
              <p>{studyFeedback(result, question.type, Boolean(study.demo))}</p>
              {result.rubric_assessment && <ul>{result.rubric_assessment.map(item => <li key={item.criterion_id}>{item.criterion_id}（{round(item.earned_points)} 分）{item.reason}</li>)}</ul>}
              {reference && !busy && <details><summary>查看參考答案與解析</summary><p>{Array.isArray(reference.answer) ? reference.answer.join('、') : reference.answer}</p><p>{reference.explanation}</p></details>}
            </div>}
          </fieldset>
        })}
        {grades && <div className="study-feedback">
          <h3>{pending ? '目前已確認分數' : '總分'} {round(grades.reduce((sum, row) => sum + (row.earned_points ?? 0), 0))} / {pending ? round(grades.reduce((sum, row) => sum + (row.earned_points === null ? 0 : row.max_points), 0)) : exam.total_points}</h3>
          {pending > 0 && <p>另有 {pending} 題待評，尚無完整總分。</p>}
          {study.summary && <><h3>學習總評</h3><p>{study.summary}</p></>}
          <div className="study-actions">
            <button type="button" className="ghost-button" disabled={disabled} onClick={() => exportReport(true)}>下載報告（HTML）</button>
            <button type="button" className="ghost-button" disabled={disabled} onClick={() => exportReport(false)}>開啟列印版</button>
          </div>
        </div>}
        {(!grades || (!study.demo && (pending > 0 || missingFeedback || !study.summary))) &&
          <button className="primary-button" disabled={disabled || (!study.demo && (!canConnect || provider === 'mock'))}>{!grades ? '送出批改' : pending ? '重試待評題' : missingFeedback ? '補產生逐題評語' : '重試產生總評'}</button>}
      </form>
    </section>}
    <dialog ref={analysisDialog} className="study-analysis-dialog" aria-labelledby="study-analysis-title" onCancel={event => event.preventDefault()}>
      <strong id="study-analysis-title">AI分析中，請勿關閉</strong>
      <p role="status">{analyzing ? busy : ''}</p>
    </dialog>
  </main>
}
