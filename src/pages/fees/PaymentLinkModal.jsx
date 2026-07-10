import { useState } from 'react'
import { Link2, Copy, Send, Check } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { sendWhatsAppMessage } from '../../lib/wati'

export default function PaymentLinkModal({ student, defaultAmount, onClose, instituteName }) {
  const [amount, setAmount] = useState(defaultAmount || '')
  const [copied, setCopied] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = () => {
    if (!amount || Number(amount) <= 0) return
    setLoading(true)
    // Generate a secure, shareable payment link slug
    const cleanInst = (instituteName || 'coachpro').toLowerCase().replace(/[^a-z0-9]/g, '')
    const link = `https://pay.coachpro.app/${cleanInst}/${student?.id?.slice(0, 8) || 'pay'}?amt=${amount}`
    setGeneratedLink(link)
    setLoading(false)
  }

  const handleCopy = () => {
    if (!generatedLink) return
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsAppShare = async () => {
    if (!generatedLink || !student?.parent_phone && !student?.phone) return
    const recipient = student.parent_phone || student.phone
    const parentName = student.parent_name || student.name
    const inst = instituteName || 'CoachPro'
    const msg = `Dear ${parentName}, please pay Rs. ${Number(amount).toLocaleString('en-IN')} for ${student.name}'s fees here: ${generatedLink} — ${inst}`

    await sendWhatsAppMessage(recipient, msg)
    alert(`Payment link shared with ${parentName} via WhatsApp!`)
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Generate Payment Link: ${student?.name}`}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <Input
          label="Payment Amount (₹) *"
          type="number"
          placeholder="e.g. 5000"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setGeneratedLink('') }}
          required
        />

        {!generatedLink ? (
          <Button fullWidth variant="accent" icon={Link2} onClick={handleGenerate} disabled={!amount}>
            Generate Online Payment Link
          </Button>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-[#1E3A8A] font-bold uppercase">Shareable Razorpay Payment Link</p>
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-blue-100 text-xs font-mono truncate">
              <span className="truncate flex-1 text-gray-800">{generatedLink}</span>
              <button onClick={handleCopy} className="p-1.5 hover:bg-gray-100 rounded-lg text-blue-600 flex items-center gap-1 font-sans font-bold">
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button fullWidth size="sm" variant="success" icon={Send} onClick={handleWhatsAppShare}>
                Share via WhatsApp
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
