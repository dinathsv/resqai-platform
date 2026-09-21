import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { BASE_URL } from '../../constants/api'
import MinimalButton from '../../components/MinimalButton'
import { useRouter } from 'expo-router'
import { Colors, Fonts, Glass } from '../../constants/theme'

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
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<{ question_id: string; option_id: string }[]>([])
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([])

  useEffect(() => {
    fetchQuestions()
  }, [])

  async function fetchQuestions() {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/api/quiz/questions?count=10`)
      setQuestions(res.data)
    } catch (e) {
      console.error('Error fetching questions:', e)
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
      const token = await AsyncStorage.getItem('token')
      if (token) {
        await axios.post(
          `${BASE_URL}/api/quiz/attempts`,
          { answers },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }
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
      return styles.optionDefault
    }
    if (option.is_correct) {
      return styles.optionCorrect
    }
    if (option.id === selectedOption && !option.is_correct) {
      return styles.optionWrong
    }
    return styles.optionDefault
  }

  function getOptionTextStyle(option: Option) {
    if (!showFeedback) {
      return styles.optionTextDefault
    }
    if (option.is_correct) {
      return styles.optionTextCorrect
    }
    if (option.id === selectedOption && !option.is_correct) {
      return styles.optionTextWrong
    }
    return styles.optionTextDefault
  }

  function getOptionLabel(option: Option): string {
    if (!showFeedback) return option.text
    if (option.is_correct) return `✓ ${option.text}`
    if (option.id === selectedOption && !option.is_correct) return `✗ ${option.text}`
    return option.text
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    )
  }

  if (finished) {
    const pct = (score / questions.length) * 100
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.finishedContainer}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreText}>
              {score} / {questions.length}
            </Text>
            <Text style={[
              styles.performanceText,
              { color: pct >= 60 ? Colors.cta : Colors.accent },
            ]}>{getPerformanceText()}</Text>
          </View>

          {wrongAnswers.length > 0 && (
            <View style={styles.reviewSection}>
              <Text style={styles.reviewHeading}>Review Mistakes</Text>
              <FlatList
                data={wrongAnswers}
                scrollEnabled={false}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }: { item: WrongAnswer }) => (
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewQuestion}>Q: {item.question}</Text>
                    <Text style={styles.reviewYours}>Your answer: {item.yourAnswer}</Text>
                    <Text style={styles.reviewCorrect}>Correct: {item.correctAnswer}</Text>
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.questionContainer}>

        <Text style={styles.progressLabel}>
          Question {currentIndex + 1} of {total}
        </Text>
        <View style={styles.progressOuter}>
          <View style={[styles.progressInner, { width: `${progressPercent}%` }]} />
        </View>

        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{question.question_text}</Text>
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
          <View style={styles.explanationContainer}>
            <Text style={styles.explanationText}>{question.explanation}</Text>
            <Text style={styles.categoryText}>Category: {question.category}</Text>
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
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textMuted,
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
    color: Colors.textMuted,
    textAlign: 'right',
    marginBottom: 8,
  },
  progressOuter: {
    height: 5,
    backgroundColor: Colors.borderLight,
    width: '100%',
    marginBottom: 20,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressInner: {
    height: 5,
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    marginBottom: 20,
  },
  questionText: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  optionBase: {
    width: '100%',
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
  },
  optionDefault: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionCorrect: {
    backgroundColor: Colors.cta,
    borderRadius: 12,
  },
  optionWrong: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
  },
  optionTextDefault: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
  },
  optionTextCorrect: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
  optionTextWrong: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
  explanationContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    paddingLeft: 12,
    paddingVertical: 14,
    paddingRight: 14,
    marginTop: 12,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  scoreText: {
    fontSize: 48,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
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
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  reviewItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
  },
  reviewQuestion: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  reviewYours: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.accent,
    marginBottom: 2,
  },
  reviewCorrect: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.cta,
  },
  finishedButtons: {
    width: '100%',
    marginTop: 16,
  },
})
