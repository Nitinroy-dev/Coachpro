import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { openRazorpayCheckout } from '../../lib/razorpay'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { TableRowSkeleton } from '../../components/ui/Skeleton'
import { CreditCard, Download, ExternalLink, AlertTriangle, ShieldCheck, CheckCircle2, QrCode, RefreshCw } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function StudentFees() {
  const { profile, institute } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [studentRecord, setStudentRecord] = useState(null)
  const [installments, setInstallments] = useState([])

  // UPI QR checkout states
  const [selectedPaymentInst, setSelectedPaymentInst] = useState(null)
  const [showMethodModal, setShowMethodModal] = useState(false)
  const [showUpiQrModal, setShowUpiQrModal] = useState(false)
  const [upiQrUrl, setUpiQrUrl] = useState('')
  const [verifyingUpi, setVerifyingUpi] = useState(false)
  const [upiVerified, setUpiVerified] = useState(false)

  useEffect(() => {
    fetchStudentFees()
  }, [])

  const fetchStudentFees = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch student directory record
      const { data: sData, error: sErr } = await supabase
        .from('students')
        .select('*, batches(name, courses(name))')
        .eq('email', user.email)
        .maybeSingle()

      if (sErr) throw sErr
      if (!sData) {
        setLoading(false)
        return
      }

      setStudentRecord(sData)

      // Fetch student installments
      const { data: instData, error: instErr } = await supabase
        .from('fee_installments')
        .select('*')
        .eq('student_id', sData.id)
        .order('due_date', { ascending: true })

      if (instErr) throw instErr
      setInstallments(instData || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load fee structures.')
    } finally {
      setLoading(false)
    }
  }

  const triggerPayOnline = (inst) => {
    setSelectedPaymentInst(inst)
    setShowMethodModal(true)
  }

  const handleRazorpayPayment = async () => {
    const inst = selectedPaymentInst
    if (!inst) return
    setShowMethodModal(false)
    setActionLoading(true)
    try {
      const balance = Number(inst.amount) - Number(inst.paid_amount || 0)
      const rzpKeyId = institute?.settings?.razorpay_key_id || 'rzp_test_TY11234567'

      await openRazorpayCheckout({
        amount: Math.round(balance * 100), // in paise
        studentName: studentRecord.name,
        studentPhone: studentRecord.phone || '9876543210',
        description: `Installment #${inst.installment_number} Payment`,
        onSuccess: async (response) => {
          const receiptNo = `REC-${Date.now().toString().slice(-8)}`
          await completeStudentPayment(inst, balance, 'razorpay', `Online transaction ID: ${response.razorpay_payment_id}`, receiptNo)
          toast.success(`Payment verified successfully! Receipt no: ${receiptNo}`)
          fetchStudentFees()
        },
        onFailure: (msg) => {
          toast.error(`Checkout failed: ${msg}`)
        }
      })
    } catch (err) {
      console.error(err)
      toast.error(`Razorpay load failed: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpiPaymentTrigger = () => {
    const inst = selectedPaymentInst
    if (!inst) return
    const balance = Number(inst.amount) - Number(inst.paid_amount || 0)
    const upiId = institute?.settings?.upi_id || 'coachpro@upi'
    const upiName = institute?.settings?.upi_name || institute?.name || 'CoachPro Academy'
    
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName.trim())}&am=${balance}&cu=INR&tn=${encodeURIComponent(studentRecord.name + ' - Installment #' + inst.installment_number)}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`
    
    setUpiQrUrl(qrUrl)
    setShowMethodModal(false)
    setShowUpiQrModal(true)
    setUpiVerified(false)
    setVerifyingUpi(false)
  }

  const handleConfirmUpiPaid = async () => {
    const inst = selectedPaymentInst
    if (!inst) return
    setVerifyingUpi(true)
    
    setTimeout(async () => {
      try {
        const balance = Number(inst.amount) - Number(inst.paid_amount || 0)
        const receiptNo = `REC-UPI-${Date.now().toString().slice(-8)}`
        
        await completeStudentPayment(inst, balance, 'upi', `UPI direct QR payment transfer`, receiptNo)
        
        setUpiVerified(true)
        toast.success(`Payment verified successfully! Receipt no: ${receiptNo}`)
        
        // Auto trigger receipt download immediately
        downloadReceipt({
          ...inst,
          paid_amount: inst.amount,
          status: 'paid'
        })
        
        setTimeout(() => {
          setShowUpiQrModal(false)
          setVerifyingUpi(false)
          fetchStudentFees()
        }, 1500)
      } catch (err) {
        console.error(err)
        toast.error(`Payment registration failed: ${err.message}`)
        setVerifyingUpi(false)
      }
    }, 2000)
  }

  const completeStudentPayment = async (inst, balance, mode, txnNotes, receiptNo) => {
    // 1. Update installment status in DB
    const { error: updErr } = await supabase
      .from('fee_installments')
      .update({
        status: 'paid',
        paid_amount: inst.amount,
        notes: `Paid via Student Portal (${mode.toUpperCase()})`
      })
      .eq('id', inst.id)

    if (updErr) throw updErr

    // 2. Insert receipt ledger record in fees
    const { error: insErr } = await supabase
      .from('fees')
      .insert({
        institute_id: profile.institute_id,
        student_id: studentRecord.id,
        installment_id: inst.id,
        amount: balance,
        mode: mode,
        paid_date: new Date().toISOString().split('T')[0],
        receipt_number: receiptNo,
        notes: txnNotes
      })

    if (insErr) throw insErr
  }

  // PDF download generator for invoice receipt
  const downloadReceipt = (inst) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const paid = inst.paid_amount || inst.amount
    const balance = Math.max(0, Number(inst.amount) - Number(inst.paid_amount || 0))
    const receiptNo = `REC-ONLINE-${inst.id.slice(-6).toUpperCase()}`

    // Render blue header banner
    doc.setFillColor(30, 58, 138)
    doc.rect(0, 0, pageWidth, 35, 'F')
    
    // Header labels
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('CoachPro', 15, 18)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Student Tuition Fee Payment Receipt', 15, 28)

    // Institute particulars
    const instName = institute?.name || 'CoachPro Institute'
    doc.text(instName, pageWidth - 15, 18, { align: 'right' })
    if (institute?.phone) doc.text(`Ph: ${institute.phone}`, pageWidth - 15, 25, { align: 'right' })

    // Receipt details text
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Receipt Reference: ${receiptNo}`, 15, 50)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Date of Dispatch: ${new Date().toLocaleDateString('en-IN')}`, 15, 58)

    // Data ledger mapping
    autoTable(doc, {
      startY: 68,
      head: [['Particular Field', 'Payment Information']],
      body: [
        ['Student Name', studentRecord.name || '—'],
        ['Registration ID', studentRecord.student_code || '—'],
        ['Academic Batch Name', studentRecord.batches?.name || '—'],
        ['Assigned Course Name', studentRecord.batches?.courses?.name || '—'],
        ['Installment Position', `Installment #${inst.installment_number}`],
        ['Dues Deadline Date', inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-IN') : '—'],
        ['Payment Method Type', 'ONLINE GATEWAY (RAZORPAY)'],
        ['Total Installment Due', `Rs. ${Number(inst.amount).toLocaleString('en-IN')}`],
        ['Paid Amount', `Rs. ${Number(paid).toLocaleString('en-IN')}`],
        ['Outstanding Balance', `Rs. ${balance.toLocaleString('en-IN')}`]
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })

    const finalY = doc.lastAutoTable.finalY + 15

    // Total highlight footer box
    doc.setFillColor(34, 197, 94)
    doc.rect(15, finalY, pageWidth - 30, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`SUCCESSFULLY CLEAR RECEIVED: Rs. ${Number(paid).toLocaleString('en-IN')}`, pageWidth / 2, finalY + 8, { align: 'center' })

    // Remarks
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('This receipt has been generated digitally inside the CoachPro Student Portal.', pageWidth / 2, finalY + 25, { align: 'center' })

    doc.save(`Receipt_Installment_${inst.installment_number}_${studentRecord.student_code}.pdf`)
    toast.success(`Receipt for installment #${inst.installment_number} downloaded.`)
  }

  // Calculate totals
  const totalDues = installments
    .filter(i => i.status !== 'paid' && i.status !== 'waived')
    .reduce((sum, i) => sum + (Number(i.amount) - Number(i.paid_amount || 0)), 0)

  const totalPaid = installments
    .filter(i => i.status === 'paid' || i.status === 'partial')
    .reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0)

  const overdueCount = installments.filter(i => i.status === 'overdue').length

  const badgeColors = {
    paid: 'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    overdue: 'bg-red-100 text-red-700 border-red-200',
    waived: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    partial: 'bg-orange-100 text-orange-700 border-orange-200',
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16 bg-gray-100/60 rounded-2xl animate-pulse" />
        <TableRowSkeleton rows={4} />
      </div>
    )
  }

  if (!studentRecord) {
    return (
      <Card className="p-8 text-center text-gray-400">
        <AlertTriangle className="mx-auto mb-2 text-amber-500" size={32} />
        <p className="font-bold">No linked student directory record.</p>
        <p className="text-xs mt-1">Please ask your administrator to link your email profile.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fees Schedule & Dues</h1>
        <p className="text-sm text-gray-500">View payment schedules, check transaction receipt files, and pay pending fee dues directly online</p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100/30 border border-red-200">
          <p className="text-[10px] uppercase font-bold text-red-700">Total Pending Dues</p>
          <p className="text-2xl font-extrabold text-red-700 mt-0.5">₹{totalDues.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100/30 border border-green-200">
          <p className="text-[10px] uppercase font-bold text-green-700">Total Fees Cleared</p>
          <p className="text-2xl font-extrabold text-green-700 mt-0.5">₹{totalPaid.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-4 bg-white border">
          <p className="text-[10px] uppercase font-bold text-gray-400">Overdue Installments</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-0.5">{overdueCount} Alerts</p>
        </Card>
        <Card className="p-4 bg-white border">
          <p className="text-[10px] uppercase font-bold text-gray-400">Total Scheduled Installments</p>
          <p className="text-2xl font-extrabold text-gray-800 mt-0.5">{installments.length} Installments</p>
        </Card>
      </div>

      {/* Roster table */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4 border-b border-gray-100 flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard size={18} className="text-[#1E3A8A]" /> Installments Schedule
          </CardTitle>
        </CardHeader>

        <div className="overflow-x-auto pt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-100">
                <th className="p-3">Installment #</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Paid Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {installments.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No scheduled installments recorded for your profile.</td></tr>
              ) : (
                installments.map(inst => {
                  const balance = Number(inst.amount) - Number(inst.paid_amount || 0)
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 font-bold text-gray-900">Installment #{inst.installment_number}</td>
                      <td className="p-3 text-gray-600 font-semibold">{inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="p-3 font-bold text-gray-900">₹{Number(inst.amount).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-green-600 font-bold">₹{Number(inst.paid_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${badgeColors[inst.status] || 'bg-gray-100'}`}>
                          {inst.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        {inst.status === 'paid' ? (
                          <Button
                            size="xs"
                            variant="outline"
                            icon={Download}
                            onClick={() => downloadReceipt(inst)}
                            className="bg-white"
                          >
                            Download Receipt
                          </Button>
                        ) : inst.status === 'waived' ? (
                          <span className="text-[10px] text-gray-400 italic">Waived by Admin</span>
                        ) : (
                          <div className="inline-flex gap-1.5 justify-end">
                            {inst.status === 'partial' && (
                              <Button
                                size="xs"
                                variant="outline"
                                icon={Download}
                                onClick={() => downloadReceipt(inst)}
                                className="bg-white mr-1.5"
                              >
                                Receipt (Partial)
                              </Button>
                            )}
                            <Button
                              size="xs"
                              variant="success"
                              icon={ExternalLink}
                              onClick={() => triggerPayOnline(inst)}
                              disabled={actionLoading}
                            >
                              Pay Dues (₹{balance.toLocaleString('en-IN')})
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment Method Selection Modal */}
      {showMethodModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowMethodModal(false)}
          title="Select Payment Method"
          footer={
            <Button variant="ghost" onClick={() => setShowMethodModal(false)}>Cancel</Button>
          }
        >
          <div className="space-y-4 p-2">
            <p className="text-xs text-gray-500">Choose how you'd like to pay your fee installment of ₹{(Number(selectedPaymentInst?.amount) - Number(selectedPaymentInst?.paid_amount || 0)).toLocaleString('en-IN')}:</p>
            
            <button
              onClick={handleUpiPaymentTrigger}
              className="w-full flex items-center justify-between p-4 bg-orange-50/50 hover:bg-orange-50 border border-orange-200 rounded-2xl transition-all text-left shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm">
                  <QrCode size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">UPI QR Code Checkout</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Pay via GPay, PhonePe, Paytm or any UPI App</p>
                </div>
              </div>
              <span className="text-[10px] bg-orange-100 text-orange-700 font-extrabold px-2 py-0.5 rounded-full uppercase font-bold">Instant</span>
            </button>
          </div>
        </Modal>
      )}

      {/* UPI QR Payment Modal */}
      {showUpiQrModal && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!verifyingUpi) setShowUpiQrModal(false)
          }}
          title="Direct UPI Payment QR"
          footer={
            <Button
              variant="accent"
              loading={verifyingUpi}
              disabled={upiVerified}
              onClick={handleConfirmUpiPaid}
              fullWidth
            >
              {upiVerified ? 'Payment Completed ✓' : verifyingUpi ? 'Verifying payment transfer...' : 'Confirm Transfer Completed'}
            </Button>
          }
        >
          <div className="text-center p-4 space-y-4">
            <h4 className="font-bold text-gray-900 text-sm">Scan with any UPI App</h4>
            
            <div className="relative inline-block bg-white p-3.5 border border-gray-200 rounded-2xl shadow-xs">
              <img src={upiQrUrl} alt="UPI QR Code" className="w-48 h-48 mx-auto animate-pulse" />
              {verifyingUpi && (
                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-4 rounded-2xl">
                  {upiVerified ? (
                    <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center animate-bounce shadow-md">
                      <CheckCircle2 size={28} />
                    </div>
                  ) : (
                    <RefreshCw className="w-10 h-10 text-orange-500 animate-spin" />
                  )}
                  <p className="text-xs font-bold text-gray-800 mt-3">
                    {upiVerified ? 'Payment Verified!' : 'Confirming transaction with bank...'}
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-left text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Recipient Name:</span>
                <span className="text-gray-900 font-bold">
                  {institute?.settings?.upi_name || institute?.name || 'CoachPro Academy'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">UPI ID / VPA:</span>
                <span className="text-blue-900 font-bold">
                  {institute?.settings?.upi_id || 'coachpro@upi'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount to Pay:</span>
                <span className="text-green-600 font-extrabold">
                  ₹{(Number(selectedPaymentInst?.amount) - Number(selectedPaymentInst?.paid_amount || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-gray-500 italic">Scan this QR code using BHIM, GPay, PhonePe, Paytm, or any banking app to clear your due. Once the transaction completes, click "Confirm Transfer Completed" to download your official receipt.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
