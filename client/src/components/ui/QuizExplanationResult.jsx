import React, { useMemo } from 'react'

const SECTION_LABELS = {
  summary: 'Summary',
  risk_factors: 'Main risk-increasing factors',
  protective_factors: 'Main protective factors',
  advice: 'Practical advice',
  disclaimer: 'Disclaimer',
}

const SECTION_ALIASES = {
  summary: ['short summary', 'summary'],
  risk_factors: [
    'main risk increasing factors',
    'main risk-increasing factors',
    'risk increasing factors',
    'risk factors',
  ],
  protective_factors: ['main protective factors', 'protective factors'],
  advice: ['practical advice', 'advice'],
  disclaimer: ['brief disclaimer', 'disclaimer'],
}

const emptySections = {
  summary: '',
  risk_factors: '',
  protective_factors: '',
  advice: '',
  disclaimer: '',
}

const cleanMarkdown = (value) => String(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/__(.*?)__/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/[ \t]+$/gm, '')
  .trim()

const normalizeHeading = (value) => {
  const normalized = cleanMarkdown(value)
    .replace(/^#+\s*/, '')
    .replace(/^\s*[-+*]\s+/, '')
    .replace(/^\s*\d+[\).:-]\s*/, '')
    .replace(/[:.]\s*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  return Object.entries(SECTION_ALIASES).find(([, aliases]) => (
    aliases.some((alias) => alias.replace(/[^a-z0-9]+/g, ' ').trim() === normalized)
  ))?.[0] || null
}

const parseExplanationText = (text) => {
  const sections = { ...emptySections }
  const buckets = Object.fromEntries(Object.keys(sections).map((key) => [key, []]))
  let activeKey = null

  cleanMarkdown(text).split('\n').forEach((rawLine) => {
    let line = rawLine.trim()
    if (!line) return

    const heading = normalizeHeading(line)
    if (heading) {
      activeKey = heading
      return
    }

    const inlineMatch = line.match(/^(?:\d+[\).:-]\s*)?([A-Za-z][A-Za-z\-\s]+?)[:\-]\s+(.+)$/)
    if (inlineMatch) {
      const inlineHeading = normalizeHeading(inlineMatch[1])
      if (inlineHeading) {
        activeKey = inlineHeading
        line = inlineMatch[2].trim()
      }
    }

    if (activeKey) {
      buckets[activeKey].push(line.replace(/^\s*[-+*]\s+/, '').trim())
    }
  })

  Object.entries(buckets).forEach(([key, value]) => {
    sections[key] = value.join('\n').trim()
  })

  return sections
}

const normalizeStructured = (structured, text) => {
  const parsed = parseExplanationText(text)
  const result = { ...emptySections, ...parsed }

  if (structured && typeof structured === 'object') {
    Object.keys(result).forEach((key) => {
      const value = structured[key]
      if (Array.isArray(value)) {
        result[key] = value.map((item) => cleanMarkdown(item)).filter(Boolean).join('\n')
      } else if (value != null && String(value).trim()) {
        result[key] = cleanMarkdown(value)
      }
    })
  }

  return result
}

const removeLeadIn = (text) => cleanMarkdown(text)
  .replace(/^the strongest risk-increasing signals are:\s*/i, '')
  .replace(/^the strongest protective signals are:\s*/i, '')
  .replace(/^use this result as a prompt to practice safer habits:\s*/i, '')

const toItems = (text) => {
  const cleaned = removeLeadIn(text)
  if (!cleaned) return []

  const lineItems = cleaned
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-+*]|\d+[\).])\s+/, '').trim())
    .filter(Boolean)

  if (lineItems.length > 1) return lineItems

  return cleaned
    .split(/;\s+|(?<=\.)\s+(?=[A-Z])/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const toParagraphs = (text) => cleanMarkdown(text)
  .split(/\n{1,}/)
  .map((paragraph) => paragraph.trim())
  .filter(Boolean)

function AssistantSection({ title, tone = 'neutral', children }) {
  return (
    <section className={`quiz-ai-section ${tone}`}>
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function BulletList({ items, emptyText }) {
  if (!items.length) {
    return <p className="quiz-ai-empty">{emptyText}</p>
  }

  return (
    <ul className="quiz-ai-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  )
}

export default function QuizExplanationResult({
  explanationText,
  structuredExplanation,
  isStreaming,
  status,
  fallback,
  riskLabel,
  riskPercent,
  riskTone,
  deterministicAdvice,
}) {
  const sections = useMemo(
    () => normalizeStructured(structuredExplanation, explanationText),
    [structuredExplanation, explanationText],
  )

  const summaryParagraphs = toParagraphs(sections.summary)
  const riskItems = toItems(sections.risk_factors)
  const protectiveItems = toItems(sections.protective_factors)
  const adviceItems = toItems(sections.advice || deterministicAdvice)
  const disclaimerParagraphs = toParagraphs(sections.disclaimer)
  const hasContent = Boolean(
    explanationText
    || summaryParagraphs.length
    || riskItems.length
    || protectiveItems.length
    || adviceItems.length
    || disclaimerParagraphs.length
  )

  const statusText = isStreaming ? (status || 'Generating explanation...') : 'Explanation ready'

  return (
    <div className={`quiz-ai-card tone-${riskTone || 'neutral'}`}>
      <div className="quiz-ai-topline">
        <span className={`quiz-ai-status-dot ${isStreaming ? 'active' : ''}`} />
        <span>{statusText}</span>
        {fallback && <span className="quiz-ai-fallback-pill">Fallback</span>}
      </div>

      <div className="quiz-ai-header">
        <div>
          <p className="quiz-ai-eyebrow">SIARA assistant explanation</p>
          <h3>Driving profile result</h3>
        </div>
        {riskLabel && (
          <div className="quiz-ai-risk-badge">
            <span>{riskLabel}</span>
            {typeof riskPercent === 'number' && <strong>{riskPercent.toFixed(2)}%</strong>}
          </div>
        )}
      </div>

      {!hasContent && (
        <div className="quiz-ai-loading">
          <span />
          <span />
          <span />
        </div>
      )}

      {hasContent && (
        <div className="quiz-ai-content">
          <AssistantSection title={SECTION_LABELS.summary} tone="summary">
            {summaryParagraphs.length ? (
              summaryParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p className="quiz-ai-empty">Waiting for the summary...</p>
            )}
          </AssistantSection>

          <div className="quiz-ai-two-col">
            <AssistantSection title={SECTION_LABELS.risk_factors} tone="risk">
              <BulletList
                items={riskItems}
                emptyText="Risk-increasing factors will appear here as the explanation streams."
              />
            </AssistantSection>

            <AssistantSection title={SECTION_LABELS.protective_factors} tone="protective">
              <BulletList
                items={protectiveItems}
                emptyText="Protective factors will appear here as the explanation streams."
              />
            </AssistantSection>
          </div>

          <AssistantSection title={SECTION_LABELS.advice} tone="advice">
            <BulletList
              items={adviceItems}
              emptyText="Practical advice will appear here as the explanation streams."
            />
          </AssistantSection>

          <div className="quiz-ai-disclaimer">
            {disclaimerParagraphs.length ? (
              disclaimerParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p>This explanation is for driving-safety education and does not change the computed score.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
