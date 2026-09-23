import React, { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native'

import { apiFetch, API_BASE } from '../../config/api'
import MinimalButton from '../../components/MinimalButton'
import { useRouter } from 'expo-router'
import { Fonts, makeCardStyles } from '../../constants/theme'
import { useTheme } from '../../context/ThemeContext'

interface Option {
  id: string
  text: string
  is_correct: boolean
}

interface Question {
  question_id: string
  question_text: string
  category: string
  explanation: string
  options: Option[]
}

interface WrongAnswer {
  question: string
  yourAnswer: string
  correctAnswer: string
}

export default function QuizScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const cardStyles = useMemo(() => makeCardStyles(theme), [theme])

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<{ question_id: string; option_id: string }[]>([])
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([])

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQuestions()
  }, [])

  async function fetchQuestions() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/quiz/questions?count=10')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setQuestions(data)
    } catch (e) {
      console.error('Error fetching questions:', e)
      setError('Unable to load quiz questions. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  function selectOption(optionId: string) {
    if (showFeedback) return
    setSelectedOption(optionId)
    setShowFeedback(true)

    const question = questions[currentIndex]
    const chosen = question.options.find((o) => o.id === optionId)
    const correct = question.options.find((o) => o.is_correct)

    if (chosen?.is_correct) {
      setScore((s) => s + 1)
    } else if (chosen && correct) {
      setWrongAnswers((prev) => [
        ...prev,
        {
          question: question.question_text,
          yourAnswer: chosen.text,
          correctAnswer: correct.text,
        },
      ])
    }

    setAnswers((prev) => [...prev, { question_id: question.question_id, option_id: optionId }])
  }

  async function nextQuestion() {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true)
      await submitAttempt()
      return
    }
    setCurrentIndex((i) => i + 1)
    setSelectedOption(null)
    setShowFeedback(false)
  }

  async function submitAttempt() {
    try {
      await apiFetch('/api/quiz/attempts', {
        method: 'POST',
        body: JSON.stringify({ answers }),
      })
    } catch (e) {
      console.error('Error submitting attempt:', e)
    }
  }

  function tryAgain() {
    setCurrentIndex(0)
    setSelectedOption(null)
    setShowFeedback(false)
    setScore(0)
    setFinished(false)
    setAnswers([])
    setWrongAnswers([])
    fetchQuestions()
  }

  function getPerformanceText(): string {
    const pct = (score / questions.length) * 100
    if (pct >= 80) return 'Excellent'
    if (pct >= 60) return 'Good'
    return 'Keep Learning'
  }

  function getOptionStyle(option: Option) {
    if (!showFeedback) {
      return {
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
      }
    }
    if (option.is_correct) {
      return {
        backgroundColor: theme.success,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.success,
      }
    }
    if (option.id === selectedOption && !option.is_correct) {
      return {
        backgroundColor: theme.error,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.error,
      }
    }
    return {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
    }
  }

  function getOptionTextStyle(option: Option) {
    if (!showFeedback) {
      return { fontSize: 15, fontFamily: Fonts.medium, color: theme.textPrimary }
    }
    if (option.is_correct) {
      return { fontSize: 15, fontFamily: Fonts.semiBold, color: '#FFFFFF' }
    }
    if (option.id === selectedOption && !option.is_correct) {
      return { fontSize: 15, fontFamily: Fonts.semiBold, color: '#FFFFFF' }
    }
    return { fontSize: 15, fontFamily: Fonts.medium, color: theme.textPrimary }
  }

  function getOptionLabel(option: Option): string {
    if (!showFeedback) return option.text
    if (option.is_correct) return `✓ ${option.text}`
    if (option.id === selectedOption && !option.is_correct) return `✗ ${option.text}`
    return option.text
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading...</Text>
      </SafeAreaView>
    )
  }

  if (error || questions.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.finishedContainer}>
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>{error || 'No questions available.'}</Text>
          <View style={{ height: 20 }} />
          <MinimalButton title="Retry" variant="outline" onPress={tryAgain} />
          <View style={{ height: 12 }} />
          <MinimalButton
            title="Back to Home"
            variant="cta"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(people)/dashboard');
              }
            }}
          />
        </View>
      </SafeAreaView>
    )
  }

  if (finished) {
    const pct = (score / questions.length) * 100
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={styles.finishedContainer}>
          <View style={[styles.scoreCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.scoreText, { color: theme.textPrimary }]}>
              {score} / {questions.length}
            </Text>
            <Text style={[
              styles.performanceText,
              { color: pct >= 60 ? theme.accent : theme.error },
            ]}>{getPerformanceText()}</Text>
          </View>

          {wrongAnswers.length > 0 && (
            <View style={styles.reviewSection}>
              <Text style={[styles.reviewHeading, { color: theme.textPrimary }]}>Review Mistakes</Text>
              <FlatList
                data={wrongAnswers}
                scrollEnabled={false}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }: { item: WrongAnswer }) => (
                  <View style={[styles.reviewItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.reviewQuestion, { color: theme.textSecondary }]}>Q: {item.question}</Text>
                    <Text style={[styles.reviewYours, { color: theme.error }]}>Your answer: {item.yourAnswer}</Text>
                    <Text style={[styles.reviewCorrect, { color: theme.success }]}>Correct: {item.correctAnswer}</Text>
                  </View>
                )}
              />
            </View>
          )}

          <View style={styles.finishedButtons}>
            <MinimalButton title="Try Again" variant="outline" onPress={tryAgain} />
            <View style={{ height: 12 }} />
            <MinimalButton
              title="Back to Home"
              variant="cta"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(people)/dashboard');
                }
              }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const question = questions[currentIndex]
  const total = questions.length
  const progressPercent = (currentIndex / total) * 100

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.questionContainer}>

        <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
          Question {currentIndex + 1} of {total}
        </Text>
        <View style={[styles.progressOuter, { backgroundColor: theme.borderSubtle }]}>
          <View style={[styles.progressInner, { width: `${progressPercent}%`, backgroundColor: theme.accent }]} />
        </View>

        <View style={[styles.questionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.questionText, { color: theme.textPrimary }]}>{question.question_text}</Text>
        </View>

        {question.options.map((option) => (
          <TouchableOpacity
            key={option.id}
            onPress={() => selectOption(option.id)}
            activeOpacity={0.7}
            disabled={showFeedback}
            style={[styles.optionBase, getOptionStyle(option)]}
          >
            <Text style={getOptionTextStyle(option)}>
              {getOptionLabel(option)}
            </Text>
          </TouchableOpacity>
        ))}

        {showFeedback && (
          <View style={[styles.explanationContainer, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: theme.accent }]}>
            <Text style={[styles.explanationText, { color: theme.textSecondary }]}>{question.explanation}</Text>
            <Text style={[styles.categoryText, { color: theme.textMuted }]}>Category: {question.category}</Text>
          </View>
        )}

        {showFeedback && (
          <View style={styles.nextButtonContainer}>
            <MinimalButton title="Next →" variant="cta" onPress={nextQuestion} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  questionContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'right',
    marginBottom: 8,
  },
  progressOuter: {
    height: 5,
    width: '100%',
    marginBottom: 20,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressInner: {
    height: 5,
    borderRadius: 3,
  },
  questionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    marginBottom: 20,
  },
  questionText: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  optionBase: {
    width: '100%',
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
  },
  explanationContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 14,
    paddingRight: 14,
    marginTop: 12,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 20,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginTop: 6,
  },
  nextButtonContainer: {
    marginTop: 20,
  },
  finishedContainer: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  scoreCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  scoreText: {
    fontSize: 48,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  performanceText: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    textAlign: 'center',
    marginTop: 8,
  },
  reviewSection: {
    width: '100%',
    marginBottom: 24,
  },
  reviewHeading: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 12,
  },
  reviewItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  reviewQuestion: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginBottom: 6,
  },
  reviewYours: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginBottom: 2,
  },
  reviewCorrect: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  finishedButtons: {
    width: '100%',
    marginTop: 16,
  },
})

