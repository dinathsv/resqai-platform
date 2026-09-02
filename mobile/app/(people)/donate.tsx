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
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { BASE_URL } from '../../constants/api'
import MinimalButton from '../../components/MinimalButton'
import MinimalInput from '../../components/MinimalInput'
import { Colors, Fonts, Glass } from '../../constants/theme'

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
      const token = await AsyncStorage.getItem('token')
      const res = await axios.get(`${BASE_URL}/api/missions?status=active`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setMissions(res.data)
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
      const token = await AsyncStorage.getItem('token')
      await axios.post(
        `${BASE_URL}/api/donations`,
        { mission_id: selectedMission.mission_id, amount: Number(amount) },
        { headers: { Authorization: `Bearer ${token}` } }
      )
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
      <View style={styles.missionCard}>
        <View style={styles.missionInfo}>
          <Text style={styles.missionTitle}>{item.title}</Text>
          <Text style={styles.missionDistrict}>{item.district}</Text>
          <View style={styles.progressOuter}>
            <View style={[styles.progressInner, { width: `${percentage}%` }]} />
          </View>
          <Text style={styles.progressText}>
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
            <View style={styles.successIconCircle}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Donation confirmed</Text>
            <Text style={styles.successAmount}>{amount} LKR</Text>
            <Text style={styles.successMission}>{selectedMission.title}</Text>
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
            <Text style={styles.modalTitle}>Secure Payment</Text>

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

            <Text style={styles.securityNote}>
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
          <Text style={styles.modalTitle}>{selectedMission.title}</Text>
          <Text style={styles.modalDescription}>
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
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Donate Relief Funds</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : (
        <FlatList
          data={missions}
          keyExtractor={(item) => item.mission_id}
          renderItem={renderMission}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No active missions</Text>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          {renderModalContent()}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  missionCard: {
    ...Glass.card,
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
    color: Colors.textPrimary,
  },
  missionDistrict: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  progressOuter: {
    height: 6,
    backgroundColor: Colors.borderLight,
    width: '100%',
    marginTop: 10,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressInner: {
    height: 6,
    backgroundColor: Colors.cta,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.cta,
    marginTop: 4,
  },
  loadingText: {
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  emptyText: {
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  errorText: {
    color: Colors.error,
    fontFamily: Fonts.medium,
    fontSize: 13,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
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
    color: Colors.textMuted,
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
    color: Colors.accent,
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
    backgroundColor: Colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successCheck: {
    fontSize: 36,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.cta,
    marginBottom: 4,
  },
  successMission: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
})
