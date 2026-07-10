import { useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, QrCode, Printer } from 'lucide-react'
import jsPDF from 'jspdf'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

export default function BatchQRModal({ batch, onClose, instituteName }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (batch?.id) fetchStudents()
  }, [batch?.id])

  const fetchStudents = async () => {
    setLoading(true)
    const { data } = await supabase.from('students').select('*').eq('batch_id', batch.id).eq('status', 'active').order('name')
    setStudents(data || [])
    setLoading(false)
  }

  const downloadBatchPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const inst = instituteName || 'CoachPro Institute'

    doc.setFillColor(30, 58, 138)
    doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(`Student ID Cards — ${batch?.name || 'Batch'}`, 15, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(inst, pageWidth - 15, 16, { align: 'right' })

    let y = 35
    students.forEach((s, idx) => {
      if (y > 250) {
        doc.addPage()
        y = 20
      }

      // Card Box
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(15, y, pageWidth - 30, 30, 3, 3, 'FD')

      doc.setTextColor(30, 58, 138)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(s.name, 25, y + 10)

      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`ID: ${s.student_code || '—'}  |  Phone: ${s.phone || '—'}`, 25, y + 18)
      doc.text(`Batch: ${batch?.name || '—'}`, 25, y + 25)

      y += 35
    })

    doc.save(`ID_Cards_${batch?.name?.replace(/[^a-z0-9]/gi, '_')}.pdf`)
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Batch ID Cards & QR Codes: ${batch?.name}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button icon={Download} onClick={downloadBatchPDF} disabled={students.length === 0}>
            Download Printable ID Cards PDF
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No active students in this batch to generate ID cards.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
          {students.map(s => (
            <div key={s.id} className="p-3 bg-white border border-gray-200 rounded-2xl text-center shadow-2xs space-y-1.5">
              <div className="bg-gray-50 p-2 rounded-xl inline-block border border-gray-100">
                <QRCodeCanvas
                  value={`COACHPRO_STUDENT_${s.id}_${s.student_code}`}
                  size={90}
                  level="M"
                />
              </div>
              <p className="font-bold text-gray-900 text-xs truncate">{s.name}</p>
              <p className="font-mono text-[10px] text-[#1E3A8A] font-bold">{s.student_code}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
