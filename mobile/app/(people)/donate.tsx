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
      <View style={styles.missionRow}>
        <View style={styles.missionInfo}>
          <Text style={styles.missionTitle}>{item.title}</Text>
          <Text style={styles.missionDistrict}>{item.district}</Text>
          <View style={styles.progressOuter}>
            <View style={[styles.progressInner, { width: `${percentage}%` }]} />
          </View>
        </View>
        <TouchableOpacity onPress={() => selectMission(item)}>
          <Text style={styles.selectText}>Select</Text>
        </TouchableOpacity>
      </View>
    )
  }

  function renderModalContent() {
    if (!selectedMission) return null

    if (paymentStep === 'success') {
      return (
        <View style={styles.modalBody}>
          <View style={styles.successContainer}>
            <Text style={styles.successCheck}>✓</Text>
            <Text style={styles.successTitle}>Donation confirmed</Text>
            <Text style={styles.successAmount}>{amount} LKR</Text>
            <Text style={styles.successMission}>{selectedMission.title}</Text>
            <View style={{ marginTop: 32 }}>
              <MinimalButton title="Done" onPress={closeModal} />
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
    backgroundColor: '#FFF',
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  missionInfo: {
    flex: 1,
    marginRight: 12,
  },
  missionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  missionDistrict: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  progressOuter: {
    height: 6,
    backgroundColor: '#DDD',
    width: '100%',
    marginTop: 8,
    borderRadius: 3,
  },
  progressInner: {
    height: 6,
    backgroundColor: '#000',
    borderRadius: 3,
  },
  selectText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  loadingText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  errorText: {
    color: 'red',
    fontSize: 13,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 15,
    color: '#333',
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
    color: '#888',
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
    color: '#000',
    textDecorationLine: 'underline',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCheck: {
    fontSize: 48,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  successMission: {
    fontSize: 15,
    color: '#666',
  },
})
