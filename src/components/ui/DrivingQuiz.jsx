import React, { useState, useEffect } from 'react'
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

export default function DrivingQuiz({ onComplete, forceShow = false }) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showResults, setShowResults] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const hasCompleted = localStorage.getItem(STORAGE_KEY)
    if (!hasCompleted) {
      setIsVisible(true)
    }
  }, [])

  // Handle forceShow - reset quiz and show it
  useEffect(() => {
    if (forceShow) {
      setCurrentSectionIndex(0)
      setCurrentQuestionIndex(0)
      setAnswers({})
      setShowResults(false)
      setIsVisible(true)
    }
  }, [forceShow])

  const currentSection = QUIZ_SECTIONS[currentSectionIndex]
  const currentQuestion = currentSection?.questions?.[currentQuestionIndex]
  
  const totalQuestions = QUIZ_SECTIONS.reduce((acc, s) => acc + s.questions.length, 0)
  const answeredCount = Object.keys(answers).length
  const progress = (answeredCount / totalQuestions) * 100

  const handleAnswer = (value) => {
    // Prevent rapid clicking during animation
    if (isAnimating || !currentQuestion) return
    
    const question = currentQuestion
    // For reversed questions (positive behaviors), invert the risk score
    const riskScore = question.reversed ? (5 - value) : value
    
    setAnswers(prev => ({
      ...prev,
      [question.id]: { value, riskScore, reversed: question.reversed }
    }))

    // Check if this is the last question BEFORE updating state
    const isLastQuestionInSection = currentQuestionIndex >= currentSection.questions.length - 1
    const isLastSection = currentSectionIndex >= QUIZ_SECTIONS.length - 1

    setIsAnimating(true)
    setTimeout(() => {
      // Move to next question
      if (!isLastQuestionInSection) {
        setCurrentQuestionIndex(prev => prev + 1)
      } else if (!isLastSection) {
        setCurrentSectionIndex(prev => prev + 1)
        setCurrentQuestionIndex(0)
      } else {
        // Quiz complete
        setShowResults(true)
      }
      setIsAnimating(false)
    }, 300)
  }

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'skipped')
    setIsVisible(false)
    onComplete?.({ skipped: true })
  }

  const handleFinish = () => {
    const results = calculateResults()
    localStorage.setItem(STORAGE_KEY, 'completed')
    localStorage.setItem(ANSWERS_KEY, JSON.stringify({ answers, results, timestamp: Date.now() }))
    setIsVisible(false)
    onComplete?.({ skipped: false, results, answers })
  }

  const calculateResults = () => {
    const sectionScores = {}
    let totalRisk = 0
    let maxPossibleRisk = 0

    QUIZ_SECTIONS.forEach(section => {
      let sectionRisk = 0
      let sectionMax = 0
      
      section.questions.forEach(q => {
        const answer = answers[q.id]
        if (answer) {
          sectionRisk += answer.riskScore
        }
        sectionMax += 5 // Max risk per question
      })

      sectionScores[section.id] = {
        title: section.title,
        icon: section.icon,
        score: sectionRisk,
        maxScore: sectionMax,
        percentage: Math.round((sectionRisk / sectionMax) * 100),
        level: getRiskLevel(sectionRisk / sectionMax)
      }

      totalRisk += sectionRisk
      maxPossibleRisk += sectionMax
    })

    const overallPercentage = Math.round((totalRisk / maxPossibleRisk) * 100)
    
    return {
      totalRisk,
      maxPossibleRisk,
      overallPercentage,
      overallLevel: getRiskLevel(totalRisk / maxPossibleRisk),
      sectionScores
    }
  }

  const getRiskLevel = (ratio) => {
    if (ratio <= 0.2) return { label: 'Very Low', color: '#22c55e', emoji: '🟢' }
    if (ratio <= 0.4) return { label: 'Low', color: '#84cc16', emoji: '🟡' }
    if (ratio <= 0.6) return { label: 'Moderate', color: '#eab308', emoji: '🟠' }
    if (ratio <= 0.8) return { label: 'High', color: '#f97316', emoji: '🔴' }
    return { label: 'Very High', color: '#dc2626', emoji: '⛔' }
  }

  const goBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    } else if (currentSectionIndex > 0) {
      const prevSection = QUIZ_SECTIONS[currentSectionIndex - 1]
      setCurrentSectionIndex(prev => prev - 1)
      setCurrentQuestionIndex(prevSection.questions.length - 1)
    }
  }

  if (!isVisible) return null

  return (
    <div className="quiz-overlay">
      <div className="quiz-modal">
        {/* Header */}
        <div className="quiz-header">
          <div className="quiz-header-left">
            <span className="quiz-logo">🚗</span>
            <div className="quiz-title-group">
              <h2 className="quiz-title">Driver Profile Assessment</h2>
              <p className="quiz-subtitle">Help us understand your driving style</p>
            </div>
          </div>
          <button className="quiz-close-btn" onClick={handleSkip} aria-label="Skip quiz">
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="quiz-progress-container">
          <div className="quiz-progress-bar">
            <div 
              className="quiz-progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="quiz-progress-info">
            <span className="quiz-progress-text">
              {answeredCount} of {totalQuestions} questions
            </span>
            <span className="quiz-progress-percent">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Content */}
        {!showResults && currentSection && currentQuestion ? (
          <div className="quiz-content">
            {/* Section Header */}
            <div className="quiz-section-header">
              <span className="quiz-section-icon">{currentSection.icon}</span>
              <span className="quiz-section-title">{currentSection.title}</span>
              <span className="quiz-section-counter">
                Section {currentSectionIndex + 1}/{QUIZ_SECTIONS.length}
              </span>
            </div>

            {/* Question */}
            <div className={`quiz-question-card ${isAnimating ? 'animating' : ''}`}>
              <div className="quiz-question-number">
                Question {currentQuestionIndex + 1} of {currentSection.questions.length}
              </div>
              <p className="quiz-question-text">{currentQuestion.text}</p>
            </div>

            {/* Answer Options */}
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

            {/* Navigation */}
            <div className="quiz-nav">
              <button 
                className="quiz-nav-btn quiz-nav-back"
                onClick={goBack}
                disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
              >
                ← Back
              </button>
              <button 
                className="quiz-nav-btn quiz-nav-skip"
                onClick={handleSkip}
              >
                Skip for now
              </button>
            </div>
          </div>
        ) : showResults ? (
          <div className="quiz-results">
            <div className="results-header">
              <span className="results-emoji">{calculateResults().overallLevel.emoji}</span>
              <h3 className="results-title">Your Risk Profile</h3>
              <div 
                className="results-overall-score"
                style={{ color: calculateResults().overallLevel.color }}
              >
                {calculateResults().overallPercentage}% Risk Score
              </div>
              <div 
                className="results-level-badge"
                style={{ backgroundColor: calculateResults().overallLevel.color }}
              >
                {calculateResults().overallLevel.label} Risk
              </div>
            </div>

            <div className="results-sections">
              {Object.entries(calculateResults().sectionScores).map(([key, section]) => (
                <div key={key} className="results-section-item">
                  <div className="results-section-info">
                    <span className="results-section-icon">{section.icon}</span>
                    <span className="results-section-name">{section.title}</span>
                  </div>
                  <div className="results-section-bar-container">
                    <div 
                      className="results-section-bar"
                      style={{ 
                        width: `${section.percentage}%`,
                        backgroundColor: section.level.color 
                      }}
                    />
                  </div>
                  <span 
                    className="results-section-percentage"
                    style={{ color: section.level.color }}
                  >
                    {section.percentage}%
                  </span>
                </div>
              ))}
            </div>

            <div className="results-message">
              <p>
                Based on your responses, we'll personalize your SIARA experience 
                to help you become a safer driver. You can retake this assessment 
                anytime from your profile settings.
              </p>
            </div>

            <button className="quiz-finish-btn" onClick={handleFinish}>
              Continue to Dashboard →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
