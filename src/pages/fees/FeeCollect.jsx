import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { openRazorpayCheckout } from '../../lib/razorpay'
import { sendWhatsAppMessage, buildMessage } from '../../lib/wati'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import FeeReceipt from './FeeReceipt'
import { Calculator, AlertTriangle, CheckCircle2, Search, User, QrCode } from 'lucide-react'

const generateReceiptNo = () => {
  const now = new Date()
  return `RCP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`
}

export default function FeeCollect({ installment, instituteId, onClose, onSaved }) {
  const { profile, institute } = useAuth()
  const activeInstituteId = profile?.institute_id || instituteId

  const [students, setStudents] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(installment?.students || null)
  const [pendingInstallments, setPendingInstallments] = useState([])
  const [selectedInstallment, setSelectedInstallment] = useState(installment || null)

  const [form, setForm] = useState({
    student_id: installment?.student_id || '',
    installment_id: installment?.id || '',
    amount: installment ? String((installment.amount || 0) - (installment.paid_amount || 0)) : '',
    paid_date: new Date().toISOString().split('T')[0],
    mode: 'cash',
    razorpay_id: '',
    notes: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedInstallment, setSavedInstallment] = useState(null)

  // UPI Payments QR Modal state
  const [showUpiQrModal, setShowUpiQrModal] = useState(false)
  const [upiQrUrl, setUpiQrUrl] = useState('')

  const upiId = institute?.settings?.upi_id || 'batchdesk@upi'
  const upiName = institute?.settings?.upi_name || institute?.name || 'Batch Desk Academy'

  useEffect(() => {
    if (activeInstituteId) fetchStudents()
  }, [activeInstituteId])

  useEffect(() => {
    if (form.student_id && activeInstituteId) {
      fetchStudentDetailsAndInstallments(form.student_id)
    }
  }, [form.student_id, activeInstituteId, students.length])



  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, name, phone, parent_name, parent_phone, photo_url, student_code, batches(name, courses(name))')
      .eq('institute_id', activeInstituteId)
      .eq('status', 'active')
      .order('name')
    setStudents(data || [])
    if (form.student_id && data) {
      const found = data.find(s => s.id === form.student_id)
      if (found) setSelectedStudent(found)
    }
  }

  const fetchStudentDetailsAndInstallments = async (studId) => {
    let st = students.find(s => s.id === studId) || installment?.students
    if (!st) {
      const { data } = await supabase
        .from('students')
        .select('id, name, phone, parent_name, parent_phone, photo_url, student_code, batches(name, courses(name))')
        .eq('id', studId)
        .maybeSingle()
      st = data
    }
    if (st) setSelectedStudent(st)

    const { data: insts } = await supabase
      .from('fee_installments')
      .select('*')
      .eq('student_id', studId)
      .not('status', 'eq', 'paid')
      .not('status', 'eq', 'waived')
      .order('due_date', { ascending: true })

    setPendingInstallments(insts || [])
    if (insts && insts.length > 0 && !selectedInstallment) {
      handleSelectInstallment(insts[0])
    }
  }

  const handleSelectInstallment = (inst) => {
    setSelectedInstallment(inst)
    const rem = (inst.amount || 0) - (inst.paid_amount || 0)
    setForm(prev => ({
      ...prev,
      installment_id: inst.id,
      amount: String(Math.max(0, rem))
    }))
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // Calculations for alerts
  const instDueAmount = selectedInstallment ? (selectedInstallment.amount || 0) - (selectedInstallment.paid_amount || 0) : 0
  const payingAmount = Number(form.amount) || 0
  const isPartial = payingAmount > 0 && payingAmount < instDueAmount
  const isOverpayment = payingAmount > instDueAmount && instDueAmount > 0
  const remainingAfterPayment = Math.max(0, instDueAmount - payingAmount)

  const totalStudentOutstanding = pendingInstallments.reduce((sum, i) => sum + ((i.amount || 0) - (i.paid_amount || 0)), 0)

  const handleRazorpay = async () => {
    const activeStudentObj = selectedStudent || installment?.students || students.find(s => s.id === form.student_id)
    if (!activeStudentObj || !form.amount) {
      setError('Select student and enter amount first.')
      return
    }
    await openRazorpayCheckout({
      amount: Math.round(payingAmount * 100),
      studentName: activeStudentObj.name || 'Student',
      studentPhone: activeStudentObj.phone || activeStudentObj.parent_phone || '9876543210',
      description: `Fee Payment — ${selectedInstallment ? `Installment #${selectedInstallment.installment_number}` : 'Manual'}`,
      onSuccess: async (response) => {
        await savePayment('razorpay', response.razorpay_payment_id)
      },
      onFailure: (msg) => setError(`Razorpay: ${msg}`),
    })
  }

  const savePayment = async (mode = form.mode, razorpayId = form.razorpay_id) => {
    if (!activeInstituteId) {
      setError('Institute configuration missing. Reload page.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const receiptNo = generateReceiptNo()
      let targetInstId = form.installment_id || selectedInstallment?.id

      const newPaidTotal = (selectedInstallment?.paid_amount || 0) + payingAmount
      const targetInstAmount = selectedInstallment?.amount || payingAmount
      const newStatus = newPaidTotal >= targetInstAmount ? 'paid' : 'partial'

      // Create installment if manual fee record without existing installment
      if (!targetInstId) {
        const { data: newInst, error: instErr } = await supabase
          .from('fee_installments')
          .insert({
            institute_id: activeInstituteId,
            student_id: form.student_id,
            installment_number: 1,
            due_date: form.paid_date,
            amount: payingAmount,
            status: 'paid',
            paid_amount: payingAmount,
            paid_date: form.paid_date,
            receipt_number: receiptNo,
            payment_mode: mode,
            notes: form.notes,
          })
          .select()
          .single()

        if (instErr) throw instErr
        targetInstId = newInst.id
      }

      // 1. Insert into fees table
      const payload = {
        student_id: form.student_id,
        institute_id: activeInstituteId,
        installment_id: targetInstId,
        amount: payingAmount,
        paid_date: form.paid_date,
        due_date: selectedInstallment?.due_date || form.paid_date,
        mode: mode,
        receipt_number: receiptNo,
        razorpay_id: razorpayId || null,
        notes: form.notes,
      }

      const { error: feeErr } = await supabase.from('fees').insert(payload)
      if (feeErr) throw feeErr

      // 2. Update fee_installments status
      if (targetInstId) {
        const { data: updatedInst } = await supabase
          .from('fee_installments')
          .update({
            paid_amount: newPaidTotal,
            paid_date: form.paid_date,
            status: newStatus,
            receipt_number: receiptNo,
            payment_mode: mode,
          })
          .eq('id', targetInstId)
          .select('*, students(*, batches(*, courses(*)))')
          .single()

        // Build receipt data — always use local known values for critical fields
        // so the receipt is never wrong due to Supabase returning null columns
        setSavedInstallment({
          // Base: either the fresh DB record or the local snapshot
          ...(updatedInst || selectedInstallment),
          // Critical overrides — these are always correct from local state
          amount: selectedInstallment?.amount || targetInstAmount,  // total installment fee (e.g. ₹15000)
          paid_amount: newPaidTotal,                                 // cumulative total paid so far
          amount_paid_now: payingAmount,                             // this transaction only (e.g. ₹1)
          status: newStatus,
          receipt_number: receiptNo,
          payment_mode: mode,                                        // 'upi', 'cash', etc.
          paid_date: form.paid_date,
          students: updatedInst?.students || selectedStudent,
        })
      }

      // 3. Log & Send WhatsApp Confirmation to Parent
      const recipientPhone = selectedStudent?.parent_phone || selectedStudent?.phone
      if (recipientPhone) {
        const msgText = buildMessage.feePaid(selectedStudent.name, payingAmount.toLocaleString('en-IN'), receiptNo, profile?.institutes?.name || 'CoachPro')
        await sendWhatsAppMessage(recipientPhone, msgText)
      }

      onSaved?.()
    } catch (err) {
      console.error('Save fee error:', err)
      setError(err.message || 'Failed to save fee payment.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.student_id) { setError('Please select a student.'); return }
    if (!form.amount || payingAmount <= 0) { setError('Enter a valid payment amount.'); return }
    
    if (form.mode === 'razorpay' && !form.razorpay_id) {
      await handleRazorpay()
    } else if (form.mode === 'upi') {
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName.trim())}&am=${payingAmount}&cu=INR&tn=${encodeURIComponent((selectedStudent?.name || 'Student') + ' - Fees')}`
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`
      setUpiQrUrl(qrUrl)
      setShowUpiQrModal(true)
    } else {
      await savePayment()
    }
  }

  // Filtered students dropdown for search
  const filteredStudentsList = students.filter(s =>
    !studentSearch ||
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.phone?.includes(studentSearch) ||
    s.student_code?.toLowerCase().includes(studentSearch.toLowerCase())
  )

  if (savedInstallment) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Payment Recorded Successfully">
        <div className="text-center p-6 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-green-500 text-white flex items-center justify-center mx-auto shadow-lg">
            <CheckCircle2 size={36} />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Payment Saved & Verified!</h3>
          <p className="text-xs text-gray-500">
            Receipt <strong className="font-mono text-[#1E3A8A]">{savedInstallment.receipt_number}</strong> generated and WhatsApp confirmation sent.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button variant="accent" icon={Calculator} onClick={() => { setSavedInstallment(null); setSelectedInstallment(null); setForm({ ...form, amount: '' }) }}>
              Collect Another Fee
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <>
      <Modal
      isOpen={true}
      onClose={onClose}
      title="Record Fee Payment"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button loading={loading} onClick={handleSubmit}>Record Payment</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student Search & Auto-Select */}
        {!installment && (
          <div className="space-y-2">
            <Input
              label="Search Student Name / Phone / ID *"
              placeholder="Type student name..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              icon={Search}
            />
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
              {filteredStudentsList.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setForm({ ...form, student_id: s.id }); setStudentSearch(s.name) }}
                  className={`p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-blue-50/60 transition-colors ${form.student_id === s.id ? 'bg-blue-50 border-l-4 border-[#1E3A8A] font-bold' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-[#1E3A8A] font-bold text-xs flex items-center justify-center overflow-hidden">
                      {s.photo_url ? <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" /> : s.name[0]}
                    </div>
                    <div>
                      <p className="text-gray-900">{s.name}</p>
                      <p className="text-[10px] text-gray-400">{s.batches?.name || 'Unassigned'} · {s.student_code}</p>
                    </div>
                  </div>
                  <span className="text-gray-500 font-mono">{s.phone}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Student Info Banner */}
        {selectedStudent && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/40 p-3.5 rounded-2xl border border-blue-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1E3A8A] text-white font-bold flex items-center justify-center overflow-hidden border border-white shadow-2xs">
                {selectedStudent.photo_url ? <img src={selectedStudent.photo_url} alt={selectedStudent.name} className="w-full h-full object-cover" /> : selectedStudent.name[0]}
              </div>
              <div>
                <p className="font-bold text-gray-900">{selectedStudent.name}</p>
                <p className="text-gray-500">{selectedStudent.batches?.courses?.name} ({selectedStudent.batches?.name})</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-gray-400">Total Outstanding</p>
              <p className="text-sm font-extrabold text-red-600">₹{totalStudentOutstanding.toLocaleString('en-IN')}</p>
            </div>
          </div>
        )}

        {/* Select Installment */}
        {pendingInstallments.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">Select Pending Installment *</label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {pendingInstallments.map(i => {
                const rem = (i.amount || 0) - (i.paid_amount || 0)
                const isSelected = selectedInstallment?.id === i.id
                const isOverdue = i.due_date && new Date(i.due_date) < new Date()
                return (
                  <div
                    key={i.id}
                    onClick={() => handleSelectInstallment(i)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-md' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div>
                      <span className="font-bold">Installment #{i.installment_number}</span>
                      <span className="ml-2 opacity-80">Due: {i.due_date ? new Date(i.due_date).toLocaleDateString('en-IN') : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${isOverdue ? 'bg-red-500 text-white' : isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {isOverdue ? 'Overdue' : i.status}
                      </span>
                      <span className="font-extrabold text-sm">₹{rem.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Amount & Date */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Amount Being Paid (₹) *"
            type="number"
            placeholder="0"
            value={form.amount}
            onChange={set('amount')}
            required
          />
          <Input
            label="Payment Date *"
            type="date"
            value={form.paid_date}
            onChange={set('paid_date')}
            required
          />
        </div>

        {/* Live Validation Warnings */}
        {isPartial && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <span><strong>Partial Payment:</strong> ₹{remainingAfterPayment.toLocaleString('en-IN')} will remain due for this installment.</span>
          </div>
        )}
        {isOverpayment && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl text-xs flex items-center gap-2">
            <Calculator size={16} className="text-blue-600 flex-shrink-0" />
            <span><strong>Overpayment Warning:</strong> Amount exceeds installment due balance by ₹{(payingAmount - instDueAmount).toLocaleString('en-IN')}.</span>
          </div>
        )}

        {/* Payment Mode */}
        <Select
          label="Payment Mode *"
          value={form.mode}
          onChange={set('mode')}
          options={[
            { value: 'cash', label: '💵 Cash' },
            { 
              value: 'upi', 
              label: (institute?.plan === 'starter' || !institute?.plan) ? '🔒 📱 UPI (Upgrade to Growth)' : '📱 UPI',
              disabled: (institute?.plan === 'starter' || !institute?.plan)
            },
            { value: 'bank_transfer', label: '🏦 Bank Transfer' },
            { value: 'cheque', label: '📝 Cheque' },
          ]}
        />

        <Input
          label="Notes / Remarks (optional)"
          placeholder="Any additional payment notes..."
          value={form.notes}
          onChange={set('notes')}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-medium">
            {error}
          </div>
        )}
      </form>
    </Modal>

      {/* UPI QR Code Payment Modal */}
      {showUpiQrModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowUpiQrModal(false)}
          title="Scan UPI QR Code to Collect"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowUpiQrModal(false)}>Cancel</Button>
              <Button variant="accent" onClick={async () => {
                setShowUpiQrModal(false)
                await savePayment('upi')
              }}>
                ✅ Confirm Payment Done
              </Button>
            </>
          }
        >
          <div className="text-center p-4 space-y-4">
            <h4 className="font-bold text-gray-900 text-sm">Direct UPI Payment QR</h4>
            
            <div className="inline-block bg-white p-3.5 border border-gray-200 rounded-2xl shadow-xs">
              <img src={upiQrUrl} alt="UPI QR Code" className="w-48 h-48 mx-auto" />
            </div>

            <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-left text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Recipient Name:</span>
                <span className="text-gray-900 font-bold">{upiName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">UPI ID / VPA:</span>
                <span className="text-blue-900 font-bold select-all">{upiId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount to Pay:</span>
                <span className="text-green-600 font-extrabold">₹{payingAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <p className="text-[10px] text-gray-500 italic">Have the student scan this QR using GPay, PhonePe, BHIM or any UPI app. Once they complete the payment, click <strong>"✅ Confirm Payment Done"</strong> to record it and print their receipt.</p>
          </div>
        </Modal>
      )}
    </>
  )
}
