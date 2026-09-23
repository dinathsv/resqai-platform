import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiFetch } from '../../config/api'
import MinimalButton from '../../components/MinimalButton'
import MinimalInput from '../../components/MinimalInput'
import { Fonts } from '../../constants/theme'
import { useTheme } from '../../context/ThemeContext'

interface Mission {
  mission_id: string
  title: string
  description: string
  district: string
  target: number
  funds_collected: number
}

type PaymentStep = 'details' | 'payment' | 'success'

export default function DonateScreen() {
  const { theme } = useTheme()

  const [missions, setMissions] = useState<Mission[]>([])
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('details')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMissions()
  }, [])

  async function fetchMissions() {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/missions?status=active')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMissions(data)
    } catch (e) {
      setError('Failed to load missions')
    } finally {
      setLoading(false)
    }
  }

  function selectMission(mission: Mission) {
    setSelectedMission(mission)
    setAmount('')
    setCardNumber('')
    setExpiry('')
    setCvv('')
    setPaymentStep('details')
    setModalVisible(true)
  }

  function proceedToPayment() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return
    setPaymentStep('payment')
  }

  async function confirmPayment() {
    if (!selectedMission) return
    try {
      const res = await apiFetch('/api/donations', {
        method: 'POST',
        body: JSON.stringify({ mission_id: selectedMission.mission_id, amount: Number(amount) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPaymentStep('success')
    } catch (e) {
      setError('Payment failed. Please try again.')
    }
  }

  function closeModal() {
    setModalVisible(false)
    setSelectedMission(null)
    setPaymentStep('details')
    if (paymentStep === 'success') {
      fetchMissions()
    }
  }

  function renderMission({ item }: { item: Mission }) {
    const percentage = item.target > 0
      ? Math.min((item.funds_collected / item.target) * 100, 100)
      : 0

    return (
      <View style={[styles.missionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.missionInfo}>
          <Text style={[styles.missionTitle, { color: theme.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.missionDistrict, { color: theme.textSecondary }]}>{item.district}</Text>
          <View style={[styles.progressOuter, { backgroundColor: theme.borderSubtle }]}>
            <View style={[styles.progressInner, { width: `${percentage}%`, backgroundColor: theme.accent }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.accent }]}>
            {Math.round(percentage)}% funded
          </Text>
        </View>
        <MinimalButton
          title="Donate"
          variant="cta"
          small
          onPress={() => selectMission(item)}
        />
      </View>
    )
  }

  function renderModalContent() {
    if (!selectedMission) return null

    if (paymentStep === 'success') {
      return (
        <View style={styles.modalBody}>
          <View style={styles.successContainer}>
            <View style={[styles.successIconCircle, { backgroundColor: theme.accent }]}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={[styles.successTitle, { color: theme.textPrimary }]}>Donation confirmed</Text>
            <Text style={[styles.successAmount, { color: theme.accent }]}>{amount} LKR</Text>
            <Text style={[styles.successMission, { color: theme.textSecondary }]}>{selectedMission.title}</Text>
            <View style={{ marginTop: 32, width: '100%' }}>
              <MinimalButton title="Done" variant="cta" onPress={closeModal} />
            </View>
          </View>
        </View>
      )
    }

    if (paymentStep === 'payment') {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBody}
        >
          <ScrollView>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Secure Payment</Text>

            <MinimalInput
              label="Card Number"
              value={cardNumber}
              onChangeText={setCardNumber}
              keyboardType="numeric"
              maxLength={16}
              placeholder="1234 5678 9012 3456"
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <MinimalInput
                  label="Expiry"
                  value={expiry}
                  onChangeText={setExpiry}
                  placeholder="MM/YY"
                  maxLength={5}
                />
              </View>
              <View style={styles.halfInput}>
                <MinimalInput
                  label="CVV"
                  value={cvv}
                  onChangeText={setCvv}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                  placeholder="123"
                />
              </View>
            </View>

            <Text style={[styles.securityNote, { color: theme.textMuted }]}>
              Payments processed securely — card not stored
            </Text>

            <MinimalButton
              title={`Confirm ${amount} LKR`}
              variant="cta"
              onPress={confirmPayment}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )
    }

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBody}
      >
        <ScrollView>
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{selectedMission.title}</Text>
          <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
            {selectedMission.description}
          </Text>

          <MinimalInput
            label="Amount (LKR)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
          />

          <MinimalButton title="Proceed to Payment" onPress={proceedToPayment} />

          <TouchableOpacity
            onPress={closeModal}
            style={styles.cancelLink}
          >
            <Text style={[styles.cancelText, { color: theme.accent }]}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.header, { color: theme.textPrimary }]}>Donate Relief Funds</Text>

      {error ? <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text> : null}

      {loading ? (
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading...</Text>
      ) : (
        <FlatList
          data={missions}
          keyExtractor={(item: Mission) => item.mission_id}
          renderItem={renderMission}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No active missions</Text>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={isWeb}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            {renderModalContent()}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isMobileWeb = isWeb && screenWidth <= 480;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  missionCard: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  missionInfo: {
    flex: 1,
    marginRight: 12,
  },
  missionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  missionDistrict: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  progressOuter: {
    height: 6,
    width: '100%',
    marginTop: 10,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressInner: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  loadingText: {
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  errorText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    ...(isWeb
      ? {
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
        }
      : {}),
  },
  modalContainer: {
    flex: 1,
    ...(isWeb
      ? ({
          width: isMobileWeb ? '100%' : 420,
          maxWidth: isMobileWeb ? '100%' : 420,
          height: isMobileWeb ? '100%' : '92%',
          maxHeight: isMobileWeb ? '100%' : 840,
          borderRadius: isMobileWeb ? 0 : 28,
          overflow: 'hidden',
          borderWidth: isMobileWeb ? 0 : 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        } as any)
      : {}),
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    lineHeight: 22,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfInput: {
    flex: 1,
  },
  securityNote: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginBottom: 20,
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    textDecorationLine: 'underline',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successCheck: {
    fontSize: 36,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  successTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  successMission: {
    fontSize: 15,
    fontFamily: Fonts.regular,
  },
})


