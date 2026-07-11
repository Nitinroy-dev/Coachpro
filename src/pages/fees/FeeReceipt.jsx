import { useRef, useState, useEffect } from 'react'
import { Download, Printer, Send, X } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { sendWhatsAppMessage } from '../../lib/wati'

export default function FeeReceipt({ installment, onClose }) {
  const { institute } = useAuth()
  const receiptRef = useRef(null)

  const student = installment?.students
  const paidNow = installment?.amount_paid_now ?? installment?.paid_amount ?? installment?.amount ?? 0
  const totalPaidSoFar = installment?.paid_amount || paidNow
  const totalInstAmount = installment?.amount || paidNow
  const date = installment?.paid_date || new Date().toISOString().split('T')[0]
  const receiptNo = installment?.receipt_number || `RCP-${Date.now()}`

  // Fetch real outstanding balance from DB — never rely on local state
  const [totalOutstanding, setTotalOutstanding] = useState(null)
  const [loadingBalance, setLoadingBalance] = useState(true)

  useEffect(() => {
    const fetchPending = async () => {
      const studentId = student?.id || installment?.student_id
      if (!studentId) { setLoadingBalance(false); return }
      const { data } = await supabase
        .from('fee_installments')
        .select('amount, paid_amount, status')
        .eq('student_id', studentId)
        .not('status', 'eq', 'waived')
      if (data) {
        const outstanding = data.reduce((sum, row) => {
          const due = (row.amount || 0) - (row.paid_amount || 0)
          return sum + Math.max(0, due)
        }, 0)
        setTotalOutstanding(outstanding)
      }
      setLoadingBalance(false)
    }
    fetchPending()
  }, [student?.id, installment?.student_id])

  // Fallback to local calc if DB fetch fails
  const remaining = totalOutstanding !== null
    ? totalOutstanding
    : Math.max(0, totalInstAmount - totalPaidSoFar)

  const handlePrint = () => {
    window.print()
  }

  const handleWhatsAppShare = async () => {
    const recipient = student?.parent_phone || student?.phone
    if (!recipient) { alert('Recipient phone missing!'); return }
    const msg = `Dear ${student?.parent_name || student?.name}, payment receipt ${receiptNo} of Rs. ${paidNow.toLocaleString('en-IN')} has been recorded for ${student?.name}. Outstanding balance: Rs. ${remaining.toLocaleString('en-IN')}. Thank you! — ${institute?.name || 'CoachPro'}`
    await sendWhatsAppMessage(recipient, msg)
    alert('Receipt sent via WhatsApp!')
  }

  const downloadPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Header
    doc.setFillColor(30, 58, 138)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('CoachPro', 15, 18)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Fee Payment Receipt', 15, 28)

    // Institute info
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    const instName = institute?.name || 'CoachPro Institute'
    doc.text(instName, pageWidth - 15, 18, { align: 'right' })
    if (institute?.phone) doc.text(`Ph: ${institute.phone}`, pageWidth - 15, 25, { align: 'right' })
    if (institute?.address) doc.text(institute.address, pageWidth - 15, 32, { align: 'right' })

    // Receipt details
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Receipt No: ${receiptNo}`, 15, 50)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Date: ${new Date(date).toLocaleDateString('en-IN')}`, 15, 58)

    // Table info
    autoTable(doc, {
      startY: 68,
      head: [['Field', 'Details']],
      body: [
        ['Student Name', student?.name || '—'],
        ['Student ID', student?.student_code || '—'],
        ['Batch', student?.batches?.name || '—'],
        ['Course', student?.batches?.courses?.name || '—'],
        ['Installment #', `Installment #${installment?.installment_number || '1'}`],
        ['Payment Mode', (installment?.payment_mode || 'cash').toUpperCase()],
        ['Total Installment Amount', `Rs. ${totalInstAmount.toLocaleString('en-IN')}`],
        ['Amount Paid This Transaction', `Rs. ${paidNow.toLocaleString('en-IN')}`],
        ['Total Paid So Far', `Rs. ${totalPaidSoFar.toLocaleString('en-IN')}`],
        ['Remaining Balance Due', remaining > 0 ? `Rs. ${remaining.toLocaleString('en-IN')} (Partial)` : 'Rs. 0 (Fully Paid)'],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })

    const finalY = doc.lastAutoTable.finalY + 20

    // Amount box
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(249, 115, 22)
    doc.rect(15, finalY, pageWidth - 30, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(`Amount Paid: Rs. ${paidNow.toLocaleString('en-IN')}`, pageWidth / 2, finalY + 9, { align: 'center' })

    // Footer
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('This is a computer-generated receipt. No signature required.', pageWidth / 2, finalY + 30, { align: 'center' })
    doc.text('Thank you for your payment! 🙏', pageWidth / 2, finalY + 37, { align: 'center' })

    doc.save(`Receipt-${receiptNo}.pdf`)
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Fee Payment Receipt"
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" icon={Printer} onClick={handlePrint} className="bg-white">Print</Button>
            <Button variant="success" icon={Send} onClick={handleWhatsAppShare}>WhatsApp</Button>
            <Button icon={Download} onClick={downloadPDF}>Download PDF</Button>
          </div>
        </div>
      }
    >
      {/* Printable Receipt Card */}
      <div ref={receiptRef} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm p-0">
        {/* Header */}
        <div className="bg-[#1E3A8A] text-white p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-extrabold text-2xl">CoachPro</p>
              <p className="text-blue-200 text-xs font-medium">Fee Payment Receipt</p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <p className="font-bold text-sm">{institute?.name || 'CoachPro Institute'}</p>
              {institute?.phone && <p className="text-blue-200">Ph: {institute.phone}</p>}
              {institute?.address && <p className="text-blue-200 max-w-xs">{institute.address}</p>}
            </div>
          </div>
        </div>

        {/* Receipt Details */}
        <div className="p-6 space-y-4">
          <div className="flex justify-between text-xs border-b border-gray-100 pb-3">
            <div>
              <span className="text-gray-400 block uppercase font-bold text-[10px]">Receipt No</span>
              <span className="font-mono font-bold text-[#1E3A8A] text-sm">{receiptNo}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block uppercase font-bold text-[10px]">Date</span>
              <span className="font-semibold text-gray-800">{new Date(date).toLocaleDateString('en-IN')}</span>
            </div>
          </div>

          {/* Student & Course Info */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-gray-400 block font-bold text-[10px] uppercase">Student</span><span className="font-bold text-gray-900">{student?.name || '—'}</span></div>
            <div><span className="text-gray-400 block font-bold text-[10px] uppercase">Student ID</span><span className="font-mono font-semibold text-[#1E3A8A]">{student?.student_code || '—'}</span></div>
            <div><span className="text-gray-400 block font-bold text-[10px] uppercase">Batch</span><span className="font-medium text-gray-800">{student?.batches?.name || '—'}</span></div>
            <div><span className="text-gray-400 block font-bold text-[10px] uppercase">Course</span><span className="font-medium text-[#F97316]">{student?.batches?.courses?.name || '—'}</span></div>
          </div>

          {/* Payment breakdown */}
          <div className="space-y-2 text-xs pt-1">
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Installment</span>
              <span className="font-bold text-gray-800">Installment #{installment?.installment_number || '1'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Payment Mode</span>
              <span className="font-bold text-gray-800 uppercase">{installment?.payment_mode || 'cash'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Total Installment Amount</span>
              <span className="font-semibold text-gray-900">₹{totalInstAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-1 text-sm font-bold text-green-600 bg-green-50 px-3 py-2 rounded-xl border border-green-100">
              <span>Amount Paid This Transaction</span>
              <span>₹{paidNow.toLocaleString('en-IN')}</span>
            </div>
            {totalPaidSoFar > paidNow && (
              <div className="flex justify-between py-1 text-xs font-semibold text-blue-700">
                <span>Total Paid So Far</span>
                <span>₹{totalPaidSoFar.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between py-1 text-xs font-semibold text-gray-600 border-t border-gray-100 pt-2 mt-1">
              <span>Total Outstanding Balance</span>
              <span className={remaining > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                {loadingBalance
                  ? <span className="text-gray-400 italic">loading...</span>
                  : remaining > 0
                    ? `₹${remaining.toLocaleString('en-IN')} remaining`
                    : '₹0 — Fully Paid ✓'
                }
              </span>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-600">Thank you for your payment! 🙏</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Computer-generated receipt · CoachPro Institute Management</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
