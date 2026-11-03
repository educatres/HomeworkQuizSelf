export type ExampleKind = 'python' | 'medical' | 'physical_therapy' | 'medical_technology' | 'general_education' | 'management'
type ExampleSet = { course_title: string; assignment_title: string; file_type: string; extension: string; students: { id: string; text: string }[] }
export const EXAMPLE_SETS: Record<ExampleKind, ExampleSet> = {
  python: {
    course_title: '程式設計', assignment_title: 'Python 資料分析作業', file_type: 'py', extension: 'py',
    students: [
      { id: 'PY-001', text: '# 銷售資料分析\nimport csv\n\ndef summarize(rows):\n    totals = {}\n    for row in rows:\n        category = row["category"]\n        totals[category] = totals.get(category, 0) + float(row["amount"])\n    return totals\n\n# 以函式封裝資料聚合，遇到缺漏欄位時先回報錯誤。' },
      { id: 'PY-002', text: '# 借閱紀錄\nfrom collections import Counter\n\ndef popular_books(records, limit=3):\n    counts = Counter(record["title"] for record in records if record.get("returned"))\n    return counts.most_common(limit)\n\n# 只統計已歸還資料，避免未完成交易影響結果。' },
      { id: 'PY-003', text: '# 文字清理\nimport re\n\ndef normalize(text):\n    cleaned = re.sub(r"\\s+", " ", text).strip().lower()\n    return cleaned\n\n# 先正規化空白與大小寫，再交給後續的關鍵字搜尋流程。' },
      { id: 'PY-004', text: '# 排程佇列\nfrom collections import deque\n\nclass JobQueue:\n    def __init__(self):\n        self.items = deque()\n    def add(self, job):\n        self.items.append(job)\n    def next(self):\n        return self.items.popleft() if self.items else None\n\n# 佇列保持先進先出，空佇列時回傳 None 而非拋出未處理錯誤。' },
      { id: 'PY-005', text: '# 模型評估\n\ndef accuracy(predictions, labels):\n    if len(predictions) != len(labels):\n        raise ValueError("length mismatch")\n    correct = sum(p == y for p, y in zip(predictions, labels))\n    return correct / len(labels) if labels else 0.0\n\n# 先檢查輸入長度，空資料集回傳零以定義邊界行為。' }
    ]
  },
  medical: {
    course_title: '醫學教育', assignment_title: '臨床案例分析作業', file_type: 'md', extension: 'md',
    students: [
      { id: 'MED-001', text: '# 胸痛案例\n患者活動時胸痛，休息後緩解。作業討論急性冠心症的初步評估，包含生命徵象、心電圖與心肌酵素，並說明危險分層後的處置優先順序。' },
      { id: 'MED-002', text: '# 發燒與咳嗽案例\n患者有發燒、咳嗽及呼吸急促。作業比較社區型肺炎與病毒感染的鑑別思路，要求連結病史、理學檢查、影像與抗生素使用的風險。' },
      { id: 'MED-003', text: '# 糖尿病衛教\n作業以新診斷第二型糖尿病個案為例，整理飲食、運動、血糖監測與藥物遵從性的衛教策略，並指出低血糖警訊與追蹤方式。' },
      { id: 'MED-004', text: '# 藥物安全\n作業分析住院病人的用藥交接流程，聚焦高警訊藥物、過敏史核對、重複用藥與出院用藥說明，提出可降低錯誤的團隊溝通做法。' },
      { id: 'MED-005', text: '# 感染控制\n作業討論疑似接觸傳染病人的照護情境，說明標準防護、隔離措施、手部衛生與採檢時機，並分析防護資源有限時的優先排序。' }
    ]
  },
  medical_technology: {
    course_title: 'Medical Technology', assignment_title: 'Clinical laboratory workflow analysis', file_type: 'md', extension: 'md',
    students: [
      { id: 'MT-001', text: '# Specimen handling\n\nAnalyze the pre-analytical workflow for blood specimens, including identification, transport temperature, and rejection criteria.' },
      { id: 'MT-002', text: '# Quality control\n\nCompare internal quality control charts and explain how a laboratory should respond to a trend or shift.' },
      { id: 'MT-003', text: '# Molecular diagnostics\n\nExplain the stages of a PCR workflow and identify contamination risks at each stage.' },
      { id: 'MT-004', text: '# Hematology case\n\nInterpret a complete blood count pattern and connect the findings to a reasonable follow-up test plan.' },
      { id: 'MT-005', text: '# Biosafety\n\nDesign a biosafety response for an accidental specimen spill, including containment, reporting, and decontamination.' }
    ]
  },
  general_education: {
    course_title: 'General Education', assignment_title: 'Media literacy and public issues', file_type: 'md', extension: 'md',
    students: [
      { id: 'GE-001', text: '# Source evaluation\n\nEvaluate the credibility of two sources about a public issue and explain which evidence is stronger and why.' },
      { id: 'GE-002', text: '# Misinformation\n\nAnalyze how a misleading claim spreads online and propose a verification workflow before sharing it.' },
      { id: 'GE-003', text: '# Public communication\n\nCompare two ways to communicate risk to a general audience while preserving accuracy and trust.' },
      { id: 'GE-004', text: '# Ethical reasoning\n\nDiscuss a public policy dilemma, identify competing values, and justify a position with evidence.' },
      { id: 'GE-005', text: '# Community observation\n\nConnect a local observation to a broader social issue and distinguish description from interpretation.' }
    ]
  },
  management: {
    course_title: 'Management', assignment_title: 'Organizational management case analysis', file_type: 'md', extension: 'md',
    students: [
      { id: 'MG-001', text: '# Team performance\n\nAnalyze a team coordination problem and recommend interventions based on roles, communication, and incentives.' },
      { id: 'MG-002', text: '# Strategic decision\n\nCompare two strategic options for a small business and explain the trade-offs under uncertainty.' },
      { id: 'MG-003', text: '# Organizational change\n\nDesign a change-management plan that addresses resistance, communication, and measurable outcomes.' },
      { id: 'MG-004', text: '# Marketing case\n\nUse customer segments and positioning to explain why a campaign underperformed and how to revise it.' },
      { id: 'MG-005', text: '# Operations improvement\n\nIdentify a process bottleneck and propose an improvement using capacity, quality, and cost considerations.' }
    ]
  },  physical_therapy: {
    course_title: 'Physical Therapy', assignment_title: 'Gait analysis and rehabilitation plan', file_type: 'md', extension: 'md',
    students: [
      { id: 'PT-001', text: '# Gait analysis\n\nThe case presents pelvic drop during walking with reduced hip abductor strength. The assignment records gait observation, muscle strength, balance, and a progressive exercise plan.' },
      { id: 'PT-002', text: '# Shoulder rehabilitation\n\nThis case is six weeks after shoulder surgery with limited range of motion. The plan sequences stretching, joint mobility, and functional training according to pain response.' },
      { id: 'PT-003', text: '# Stroke balance training\n\nThe patient shows asymmetric weight bearing and needs support while turning. The assessment covers static balance, dynamic balance, and transfer safety.' },
      { id: 'PT-004', text: '# Low back pain exercise plan\n\nThe plan starts from functional limitations and combines core stability, hip mobility, and daily activity education. Exercise intensity is adjusted by symptoms.' },
      { id: 'PT-005', text: '# Knee osteoarthritis\n\nThe patient reports knee pain when using stairs. The analysis combines muscle strength, joint range of motion, and gait function to design low-impact strengthening.' }
    ]
  }
}

export const EXAMPLE_BUTTONS: { kind: ExampleKind; label: string }[] = [
    { kind: 'python', label: 'Python 程式作業' },
    { kind: 'medical', label: '醫學相關作業' },
    { kind: 'physical_therapy', label: '物理治療作業' },
    { kind: 'medical_technology', label: '醫技系' },
    { kind: 'general_education', label: '通識' },
    { kind: 'management', label: '管理學科' }
  ]
