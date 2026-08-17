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
    } catch (e)  finally {
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
    } catch (e) 
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
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.finishedContainer}>
          <Text style={styles.scoreText}>
            {score} / {questions.length}
          </Text>
          <Text style={styles.performanceText}>{getPerformanceText()}</Text>

          {wrongAnswers.length > 0 && (
            <View style={styles.reviewSection}>
              <FlatList
                data={wrongAnswers}
                scrollEnabled={false}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
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
            <MinimalButton title="Back to Home" onPress={() => router.back()} />
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

        <Text style={styles.questionText}>{question.question_text}</Text>

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
            <MinimalButton title="Next →" onPress={nextQuestion} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  loadingText: {
    color: '#888',
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
    color: '#888',
    textAlign: 'right',
    marginBottom: 8,
  },
  progressOuter: {
    height: 4,
    backgroundColor: '#DDD',
    width: '100%',
    marginBottom: 24,
  },
  progressInner: {
    height: 4,
    backgroundColor: '#000',
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginVertical: 24,
  },
  optionBase: {
    width: '100%',
    padding: 14,
    marginBottom: 10,
    borderRadius: 4,
  },
  optionDefault: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#000',
  },
  optionCorrect: {
    backgroundColor: '#000',
  },
  optionWrong: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#000',
  },
  optionTextDefault: {
    fontSize: 15,
    color: '#000',
  },
  optionTextCorrect: {
    fontSize: 15,
    color: '#FFF',
  },
  explanationContainer: {
    borderLeftWidth: 2,
    borderLeftColor: '#000',
    paddingLeft: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  categoryText: {
    fontSize: 11,
    color: '#888',
    marginTop: 6,
  },
  nextButtonContainer: {
    marginTop: 20,
  },
  finishedContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  performanceText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  reviewSection: {
    width: '100%',
    marginBottom: 24,
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  reviewQuestion: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  reviewYours: {
    fontSize: 14,
    color: 'red',
    marginBottom: 2,
  },
  reviewCorrect: {
    fontSize: 14,
    color: '#000',
  },
  finishedButtons: {
    width: '100%',
    marginTop: 16,
  },
})
