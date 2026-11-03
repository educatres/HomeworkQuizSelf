import { useRef, useState } from 'react'
import { TriplePercentageSlider, normalizeValues } from '../components/TriplePercentageSlider'
import { DEFAULT_PLAN, type BatchPlan } from '../domain/types'

export type StudyPlan = Pick<BatchPlan, 'type_weights' | 'level_weights' | 'teacher_guidance'>

export function readStudyPlan(value: unknown): StudyPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('命題組態必須是 JSON 物件。')
  const raw = value as Partial<StudyPlan> & { schema_version?: unknown }
  if (raw.schema_version !== undefined && raw.schema_version !== '1.0') throw new Error('不支援此命題組態版本。')
  if (!raw.type_weights && !raw.level_weights && typeof raw.teacher_guidance !== 'string') {
    throw new Error('組態缺少題型配比、理解層次或命題指導。')
  }
  function readWeights<T extends Record<string, number>>(defaults: T, candidate: T | undefined): T {
    if (candidate === undefined) return defaults
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('配比格式無效。')
    const keys = Object.keys(defaults)
    const values = keys.map(key => candidate[key])
    if (values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) || !values.some(value => value > 0)) {
      throw new Error('配比必須包含三項 0 到 100 的數字，且至少一項大於零。')
    }
    const normalized = normalizeValues(values)
    return Object.fromEntries(keys.map((key, index) => [key, normalized[index]])) as T
  }
  return {
    type_weights: readWeights(DEFAULT_PLAN.type_weights, raw.type_weights),
    level_weights: readWeights(DEFAULT_PLAN.level_weights, raw.level_weights),
    teacher_guidance: typeof raw.teacher_guidance === 'string' ? raw.teacher_guidance : '',
  }
}

export function StudyPlanPanel({ plan, setPlan, disabled }: {
  plan: StudyPlan
  setPlan: (plan: StudyPlan) => void
  disabled: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  function updatePlan<K extends keyof StudyPlan>(key: K, value: StudyPlan[K]) {
    setPlan({ ...plan, [key]: value })
  }
  function download() {
    const blob = new Blob([JSON.stringify({ schema_version: '1.0', ...plan }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'quiz_plan_self_study.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }
  async function importConfig(file: File) {
    try {
      setPlan(readStudyPlan(JSON.parse(await file.text())))
      setMessage('已匯入命題方向組態，會用於下一次出題。')
    } catch (error) {
      setMessage(error instanceof SyntaxError ? '檔案不是有效的 JSON。' : (error as Error).message)
    }
  }
  return <><div className="plan-options"><div className="weight-editor"><h3>題型配比</h3><div className="type-guide"><p>題型決定學生如何呈現自己的理解；「理解層次」則決定題目要檢查多深入。兩者可以交叉搭配，不必固定一對一對應。</p><ul><li><strong>單選題</strong><span>適合檢核作業中的內容、觀念、流程或基本因果關係。答案明確時，可由系統進行一致的本地評分。</span></li><li><strong>複選題</strong><span>適合檢核多個條件、步驟、限制或影響是否同時成立。</span></li><li><strong>簡答題</strong><span>適合要求學生說明推理依據、條件改變後的影響、方法限制，或比較不同方案的設計取捨。AI 可依 rubric 協助分析，但低信心、答案有歧義或涉及評量公平性時，建議由教師人工覆核。</span></li></ul><p className="type-guide-note">「內容與觀念」通常適合用單選題快速確認；「脈絡與推理」可以使用複選題或簡答題；「設計取捨」通常較適合簡答題，讓學生說明選擇某種方法的理由、限制與可能替代方案。</p></div><TriplePercentageSlider values={[plan.type_weights.single_choice, plan.type_weights.multiple_choice, plan.type_weights.short_answer]} labels={['單選題', '複選題', '簡答題']} colors={['#4285E8', '#20AD87', '#F3AC40']} initialValues={[40, 20, 40]} disabled={disabled} onChange={values => updatePlan('type_weights', { ...plan.type_weights, single_choice: values[0], multiple_choice: values[1], short_answer: values[2] })} /><small>三種題型會依 5% 刻度連動，總和固定為 100%。</small></div><div className="weight-editor"><h3>理解層次</h3><div className="level-guide"><p>題目會從三個層次檢查學生是否真正理解自己的作業：先看能否讀懂內容，再看能否連結證據進行推論，最後看能否說明做法背後的選擇與理由。</p><ol><li><strong>理解：內容與觀念</strong><span>指出作業中實際採用的做法、觀念或流程，並說明它的作用。範例：在「校園垃圾分類問卷調查」中，哪一項屬於研究實際採用的問卷資料處理方式？</span></li><li><strong>推理：脈絡與證據</strong><span>把不同段落、研究結果或流程連結起來，根據作業中的證據推導合理結論。範例：哪一項調查發現最能支持「應先增加回收點」這個建議？請說明兩者的關聯。</span></li><li><strong>設計取捨：選擇與理由</strong><span>說明作者為什麼採用某種方法、考量哪些限制，以及改用其他方法可能產生的影響。範例：作者為什麼選擇問卷調查，而不是實地觀察？這個選擇帶來哪些優點與限制？</span></li></ol><p className="level-guide-note">大部分學生能回答第一層；真正拉開理解差距的是後兩層：能否說明結論為什麼成立，以及為什麼採用這個做法。</p></div><TriplePercentageSlider values={[plan.level_weights.comprehension, plan.level_weights.reasoning, plan.level_weights.design_tradeoff]} labels={['理解', '推理', '設計取捨']} colors={['#4285E8', '#20AD87', '#F3AC40']} disabled={disabled} onChange={values => updatePlan('level_weights', { ...plan.level_weights, comprehension: values[0], reasoning: values[1], design_tradeoff: values[2] })} /><small>三個層次會依 5% 刻度連動，總和固定為 100%。</small></div></div>
    <label className="field"><span>命題指導（選填）</span>
      <textarea rows={3} value={plan.teacher_guidance} disabled={disabled} onChange={e => updatePlan('teacher_guidance', e.target.value)} />
    </label>
    <div className="plan-config-panel">
      <h3>命題方向組態</h3>
      <p>可沿用舊版組態中的題型配比、理解層次與命題指導。下載的 JSON 只包含這三項設定。</p>
      <div className="plan-config-actions">
        <button type="button" className="ghost-button" disabled={disabled} onClick={download}>下載命題方向組態</button>
        <button type="button" className="ghost-button" disabled={disabled} onClick={() => input.current?.click()}>匯入命題方向組態</button>
        <input ref={input} type="file" accept=".json,application/json" disabled={disabled} hidden onChange={e => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void importConfig(file)
        }} />
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  </>
}
