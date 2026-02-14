import React, { useEffect, useMemo, useState } from 'react'
import '../../styles/DrivingQuiz.css'

const QUIZ_SECTIONS = [
  {
    id: 'attention',
    title: 'Attention & Focus',
    icon: '🧠',
    questions: [
      { id: 1, text: "How often do you find your mind wandering away from driving while you're behind the wheel?", reversed: false },
      { id: 2, text: "How often do you realize you missed something on the road because you weren't fully paying attention?", reversed: false },
    ]
  },
  {
    id: 'anxiety',
    title: 'Driving Anxiety',
    icon: '😰',
    questions: [
      { id: 3, text: "How often do you feel nervous or tense when driving, even in normal traffic?", reversed: false },
      { id: 4, text: "How often do you worry about getting into a crash while you're driving?", reversed: false },
    ]
  },
  {
    id: 'risk-taking',
    title: 'Risk Taking',
    icon: '⚡',
    questions: [
      { id: 5, text: "How often do you take chances while driving, like overtaking when it's a bit risky?", reversed: false },
      { id: 6, text: "How often do you feel comfortable driving faster than others when the road is clear?", reversed: false },
      { id: 7, text: "How often do you push yourself to drive in situations you know are a bit dangerous (like on narrow or busy roads)?", reversed: false },
    ]
  },
  {
    id: 'anger',
    title: 'Anger & Aggression',
    icon: '😤',
    questions: [
      { id: 8, text: "How often do you feel angry or furious at other drivers when they annoy you?", reversed: false },
      { id: 9, text: "How often do you get frustrated and drive more aggressively after being cut off?", reversed: false },
      { id: 10, text: "How often do you shout at other drivers or make rude gestures at them?", reversed: false },
    ]
  },
  {
    id: 'sensation',
    title: 'Sensation Seeking',
    icon: '🏎️',
    questions: [
      { id: 11, text: "How often do you drive much faster than the speed limit for the thrill of it?", reversed: false },
      { id: 12, text: "How often do you feel excited when driving at very high speeds on open roads?", reversed: false },
    ]
  },
  {
    id: 'stress-relief',
    title: 'Stress Relief',
    icon: '🧘',
    questions: [
      { id: 13, text: "How often do you drive to relax or reduce stress?", reversed: true },
      { id: 14, text: "How often do you take a drive just to clear your mind or calm down?", reversed: true },
      { id: 15, text: "How often do you feel less stressed after a long drive?", reversed: true },
    ]
  },
  {
    id: 'patience',
    title: 'Patience & Calmness',
    icon: '😌',
    questions: [
      { id: 16, text: "How often do you stay calm and patient even when you're stuck in a traffic jam?", reversed: true },
      { id: 17, text: "How often do you keep your cool when other drivers are slow or make mistakes?", reversed: true },
    ]
  },
  {
    id: 'safety',
    title: 'Safety Consciousness',
    icon: '🛡️',
    questions: [
      { id: 18, text: "How often do you drive carefully to avoid accidents?", reversed: true },
      { id: 19, text: "How often do you follow all traffic rules (speed limits, signals, etc.) because safety is important to you?", reversed: true },
      { id: 20, text: "How often do you pay extra attention to the road and surroundings to avoid mistakes?", reversed: true },
    ]
  },
  {
    id: 'violations',
    title: 'Traffic Violations',
    icon: '🚦',
    questions: [
      { id: 21, text: "How often do you exceed the speed limit when driving?", reversed: false },
      { id: 22, text: "How often do you tailgate (follow too closely) the vehicle in front of you?", reversed: false },
      { id: 23, text: "How often do you overtake another vehicle by briefly driving in the oncoming lane?", reversed: false },
      { id: 24, text: "How often do you drive through a red light or fail to fully stop at a stop sign?", reversed: false },
      { id: 25, text: "How often do you use your mobile phone (text or call) while driving?", reversed: false },
      { id: 26, text: "How often do you get angry at other drivers and express it by shouting or honking?", reversed: false },
    ]
  },
  {
    id: 'errors',
    title: 'Driving Errors',
    icon: '⚠️',
    questions: [
      { id: 27, text: "How often do you misjudge the distance or speed of another vehicle when overtaking or merging?", reversed: false },
      { id: 28, text: "How often do you accidentally press the gas pedal when you meant to hit the brake (or vice versa)?", reversed: false },
      { id: 29, text: "How often do you fail to notice a traffic sign or signal until it's too late?", reversed: false },
      { id: 30, text: "How often do you overlook a pedestrian or cyclist when making a turn?", reversed: false },
      { id: 31, text: "How often do you have to brake suddenly because you only just noticed something you missed?", reversed: false },
    ]
  },
  {
    id: 'lapses',
    title: 'Memory Lapses',
    icon: '💭',
    questions: [
      { id: 32, text: "How often do you find yourself driving on \"autopilot,\" arriving at your destination without remembering parts of the trip?", reversed: false },
      { id: 33, text: "How often do you miss your exit or turn because you were distracted or daydreaming?", reversed: false },
      { id: 34, text: "How often do you get lost or forget which way to go while driving?", reversed: false },
      { id: 35, text: "How often do you forget where you parked your car?", reversed: false },
    ]
  },
  {
    id: 'habits',
    title: 'Driving Habits',
    icon: '🚗',
    questions: [
      { id: 36, text: "How often do you forget to signal when changing lanes or turning?", reversed: false },
      { id: 37, text: "How often do you forget to check your mirrors or blind spots before changing lanes?", reversed: false },
      { id: 38, text: "How often do you become distracted (by something like a phone or music) and then miss something happening on the road?", reversed: false },
      { id: 39, text: "How often do you start driving without fastening your seatbelt and realize it soon after?", reversed: false },
      { id: 40, text: "How often do you find yourself multitasking (like adjusting the radio or grabbing something) and briefly drifting out of your lane?", reversed: false },
    ]
  },
]

const ANSWER_OPTIONS = [
  { value: 0, label: 'Never', color: '#22c55e' },
  { value: 1, label: 'Rarely', color: '#84cc16' },
  { value: 2, label: 'Sometimes', color: '#eab308' },
  { value: 3, label: 'Often', color: '#f97316' },
  { value: 4, label: 'Very Often', color: '#ef4444' },
  { value: 5, label: 'Always', color: '#dc2626' },
]

const STORAGE_KEY = 'siara_quiz_completed'
const ANSWERS_KEY = 'siara_quiz_answers'
const MODEL_ENDPOINT = 'http://localhost:5000/api/model/predict'

const avg = (list) => {
  if (!list.length) return 0
  return list.reduce((sum, value) => sum + value, 0) / list.length
}

const round = (value) => Number(value.toFixed(4))
const scoreToPercent = (v) => Math.round((Math.min(Math.max(v, 0), 5) / 5) * 100)

export default function DrivingQuiz({ onComplete, forceShow = false }) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [isAnimating, setIsAnimating] = useState(false)
  const [prediction, setPrediction] = useState('')
  const [riskPercent, setRiskPercent] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [featureScores, setFeatureScores] = useState({})

  useEffect(() => {
    const hasCompleted = localStorage.getItem(STORAGE_KEY)
    if (!hasCompleted) {
      setIsVisible(true)
    }
  }, [])

  useEffect(() => {
    if (forceShow) {
      setCurrentSectionIndex(0)
      setCurrentQuestionIndex(0)
      setAnswers({})
      setPrediction('')
      setRiskPercent(null)
      setSubmitError('')
      setFeatureScores({})
      setIsVisible(true)
    }
  }, [forceShow])

function getRiskLevel(value) {
  if (value < 17) {
    return { label: 'Very Low', color: '#22c55e', emoji: '😄' };
  } else if (value < 34) {
    return { label: 'Low', color: '#84cc16', emoji: '🙂' };
  } else if (value < 51) {
    return { label: 'Moderate', color: '#eab308', emoji: '😐' };
  } else if (value < 67) {
    return { label: 'Elevated', color: '#f97316', emoji: '😟' };
  } else if (value < 84) {
    return { label: 'High', color: '#f94f16', emoji: '😨' };
  } else {
    return { label: 'Extreme', color: '#ef4444', emoji: '😱' };
  }
}



  const currentSection = QUIZ_SECTIONS[currentSectionIndex]
  const currentQuestion = currentSection?.questions?.[currentQuestionIndex]

  const totalQuestions = useMemo(() => QUIZ_SECTIONS.reduce((acc, s) => acc + s.questions.length, 0), [])
  const answeredCount = Object.keys(answers).length
  const progress = (answeredCount / totalQuestions) * 100

  const computeSectionMeans = (sourceAnswers) => {
    const sections = {}

    QUIZ_SECTIONS.forEach((section) => {
      const scores = section.questions
        .map((q) => sourceAnswers[q.id]?.riskScore)
        .filter((v) => typeof v === 'number')

      sections[section.id] = avg(scores)
    })

    return sections
  }

  const buildFeatureScores = (sourceAnswers) => {
    const sectionMeans = computeSectionMeans(sourceAnswers)

    return {
      dissociative: round(sectionMeans.attention || 0),
      anxious: round(sectionMeans.anxiety || 0),
      risky: round(sectionMeans['risk-taking'] || 0),
      angry: round(sectionMeans.anger || 0),
      high_velocity: round(sectionMeans.sensation || 0),
      distress_reduction: round(sectionMeans['stress-relief'] || 0),
      patient: round(sectionMeans.patience || 0),
      careful: round(sectionMeans.safety || 0),
      errors: round(avg([sectionMeans.errors || 0, sectionMeans.habits || 0])),
      violations: round(sectionMeans.violations || 0),
      lapses: round(sectionMeans.lapses || 0),
    }
  }

  const submitPrediction = async (sourceAnswers) => {
    const rawFeatureScores = buildFeatureScores(sourceAnswers)
    setFeatureScores(rawFeatureScores)
    setIsSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch(MODEL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawFeatureScores),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Model service error')
      }

      setPrediction(data.prediction)
      setRiskPercent(typeof data.risk_percent === 'number' ? data.risk_percent : null)
      localStorage.setItem(STORAGE_KEY, 'completed')
      localStorage.setItem(
        ANSWERS_KEY,
        JSON.stringify({ answers: sourceAnswers, featureScores: rawFeatureScores, prediction: data.prediction, riskPercent: data.risk_percent, timestamp: Date.now() })
      )

      onComplete?.({ skipped: false, prediction: data.prediction, riskPercent: data.risk_percent, featureScores: rawFeatureScores, answers: sourceAnswers })
    } catch (error) {
      setSubmitError(error.message || 'Could not get model prediction')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAnswer = (value) => {
    if (isAnimating || !currentQuestion || isSubmitting) return

    const question = currentQuestion
    const riskScore = question.reversed ? (5 - value) : value
    const updatedAnswers = {
      ...answers,
      [question.id]: { value, riskScore, reversed: question.reversed }
    }

    setAnswers(updatedAnswers)

    const isLastQuestionInSection = currentQuestionIndex >= currentSection.questions.length - 1
    const isLastSection = currentSectionIndex >= QUIZ_SECTIONS.length - 1

    setIsAnimating(true)
    setTimeout(() => {
      if (!isLastQuestionInSection) {
        setCurrentQuestionIndex((prev) => prev + 1)
      } else if (!isLastSection) {
        setCurrentSectionIndex((prev) => prev + 1)
        setCurrentQuestionIndex(0)
      } else {
        submitPrediction(updatedAnswers)
      }
      setIsAnimating(false)
    }, 250)
  }

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'skipped')
    setIsVisible(false)
    onComplete?.({ skipped: true })
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  const goBack = () => {
    if (isSubmitting || prediction) return

    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
    } else if (currentSectionIndex > 0) {
      const prevSection = QUIZ_SECTIONS[currentSectionIndex - 1]
      setCurrentSectionIndex((prev) => prev - 1)
      setCurrentQuestionIndex(prevSection.questions.length - 1)
    }
  }

  if (!isVisible) return null

  return (
    <div className="quiz-overlay">
      <div className="quiz-modal">
        <div className="quiz-header">
          <div className="quiz-header-left">
            <span className="quiz-logo">🚗</span>
            <div className="quiz-title-group">
              <h2 className="quiz-title">Driver Profile Assessment</h2>
              <p className="quiz-subtitle">Answer questions, then we send scores to model service</p>
            </div>
          </div>
          <button className="quiz-close-btn" onClick={handleSkip} aria-label="Skip quiz">
            X
          </button>
        </div>

        <div className="quiz-progress-container">
          <div className="quiz-progress-bar">
            <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="quiz-progress-info">
            <span className="quiz-progress-text">{answeredCount} of {totalQuestions} questions</span>
            <span className="quiz-progress-percent">{Math.round(progress)}%</span>
          </div>
        </div>

        {!prediction && !isSubmitting ? (
          <div className="quiz-content">
            <div className="quiz-section-header">
              <span className="quiz-section-icon">{currentSection.icon}</span>
              <span className="quiz-section-title">{currentSection.title}</span>
              <span className="quiz-section-counter">Section {currentSectionIndex + 1}/{QUIZ_SECTIONS.length}</span>
            </div>

            <div className={`quiz-question-card ${isAnimating ? 'animating' : ''}`}>
              <div className="quiz-question-number">Question {currentQuestionIndex + 1} of {currentSection.questions.length}</div>
              <p className="quiz-question-text">{currentQuestion.text}</p>
            </div>

            <div className="quiz-answers">
              {ANSWER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`quiz-answer-btn ${answers[currentQuestion.id]?.value === option.value ? 'selected' : ''}`}
                  onClick={() => handleAnswer(option.value)}
                  disabled={isAnimating}
                  style={{ '--answer-color': option.color }}
                >
                  <span className="answer-indicator" style={{ backgroundColor: option.color }} />
                  <span className="answer-label">{option.label}</span>
                  <span className="answer-value">{option.value}</span>
                </button>
              ))}
            </div>

            <div className="quiz-nav">
              <button className="quiz-nav-btn quiz-nav-back" onClick={goBack} disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}>
                Back
              </button>
              <button className="quiz-nav-btn quiz-nav-skip" onClick={handleSkip}>
                Skip for now
              </button>
            </div>
          </div>
        ) : (
          <div className="quiz-results">
            <div className="results-header">
              <h3 className="results-title">Model Result</h3>
              {isSubmitting && <div className="results-message"><p>Sending feature scores to model service...</p></div>}
              {!isSubmitting && prediction && <div className="results-overall-score" style={{ color: getRiskLevel(riskPercent)?.color || '#000' }}>{prediction}</div>}
              {!isSubmitting && prediction && typeof riskPercent === 'number' && (
                <div className="results-message">
                  <p>Risk score: {riskPercent.toFixed(2)}% ({getRiskLevel(riskPercent).label})</p>
                </div>
              )}
              {!isSubmitting && submitError && <div className="results-message"><p>{submitError}</p></div>}
            </div>

            <div className="results-sections">
              {Object.entries(featureScores).map(([key, value]) => (
                <div key={key} className="results-section-item">
                  <div className="results-section-info">
                    <span className="results-section-icon">{getRiskLevel(scoreToPercent(value)).emoji}</span>
                    <span className="results-section-name">{key.replaceAll('_', ' ')}</span>
                  </div>

                  <div className="results-section-bar-container">
                    <div className="results-section-bar" style={{ width: `${scoreToPercent(value)}%`, backgroundColor: getRiskLevel(scoreToPercent(value)).color }} />
                  </div>

                  <span className="results-section-percentage">{scoreToPercent(value)}%</span>
                </div>
              ))}
            </div>

            {!isSubmitting && prediction && (
              <button className="quiz-finish-btn" onClick={handleClose}>
                Continue
              </button>
            )}

            {!isSubmitting && submitError && (
              <button className="quiz-finish-btn" onClick={() => submitPrediction(answers)}>
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

