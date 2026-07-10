import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CreditCard, Shield, AlertCircle, CheckCircle2, Download, Send, QrCode, Upload,
  Clock, Check, Sparkles, AlertTriangle, ArrowRight, Tag, HelpCircle, RefreshCw
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { sendWhatsAppMessage } from '../../lib/wati'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge, { StatusBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'

const PLAN_PRICES = {
  starter: { monthly: 799, annual: 7190, students: 150, batches: 8, staff: 2 },
  growth: { monthly: 1499, annual: 13490, students: 400, batches: 20, staff: 6 },
  pro: { monthly: 2499, annual: 22490, students: 1000, batches: 999, staff: 15 },
  enterprise: { monthly: 3999, annual: 35990, students: 99999, batches: 9999, staff: 999 },
}

export default function Billing() {
  const { profile, institute, refreshProfile } = useAuth()
  const instituteId = profile?.institute_id
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const [selectedPlan, setSelectedPlan] = useState(location.state?.plan || institute?.plan || 'growth')
  const [billingCycle, setBillingCycle] = useState(location.state?.billing || 'monthly')

  // Usage Stats
  const [usage, setUsage] = useState({ students: 0, batches: 0, staff: 0 })

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState(0) // percentage or fixed
  const [couponMsg, setCouponMsg] = useState(null)

  // Manual UPI Form
  const [upiForm, setUpiForm] = useState({
    utr: '',
    screenshot: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  })

  // History & Loading
  const [paymentsHistory, setPaymentsHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Fresh institute data (to pick up superadmin-applied discounts without re-login)
  const [freshInstitute, setFreshInstitute] = useState(null)

  // UPI QR checkout states
  const [showUpiQrModal, setShowUpiQrModal] = useState(false)
  const [upiQrUrl, setUpiQrUrl] = useState('')
  const [upiDeepLink, setUpiDeepLink] = useState('')
  const [verifyingUpi, setVerifyingUpi] = useState(false)
  const [upiVerified, setUpiVerified] = useState(false)
  const [utrInput, setUtrInput] = useState('')
  const [paidAmountInput, setPaidAmountInput] = useState('')
  const [upiSubmitStep, setUpiSubmitStep] = useState('pay') // 'pay' | 'confirm' | 'submitted'

  useEffect(() => {
    if (instituteId) {
      fetchUsageStats()
      fetchPaymentHistory()
      fetchFreshInstitute()
    }
  }, [instituteId])

  const fetchFreshInstitute = async () => {
    try {
      const { data } = await supabase
        .from('institutes')
        .select('*')
        .eq('id', instituteId)
        .single()
      if (data) setFreshInstitute(data)
    } catch (err) {
      console.error('Failed to fetch fresh institute:', err)
    }
  }

  const fetchUsageStats = async () => {
    const [studRes, batchRes, staffRes] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('institute_id', instituteId).eq('status', 'active'),
      supabase.from('batches').select('id', { count: 'exact', head: true }).eq('institute_id', instituteId),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('institute_id', instituteId)
    ])

    setUsage({
      students: studRes.count || 0,
      batches: batchRes.count || 0,
      staff: staffRes.count || 0
    })
  }

  const fetchPaymentHistory = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('payments').select('*').eq('institute_id', instituteId).order('created_at', { ascending: false })
      setPaymentsHistory(data || [])
    } catch (err) {
      console.error('Fetch payments history error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Use freshInstitute (from DB) so superadmin discounts show without re-login
  const liveInstitute = freshInstitute || institute

  // Calculate Plan Pricing Details
  const planInfo = PLAN_PRICES[selectedPlan] || PLAN_PRICES.growth
  const basePrice = billingCycle === 'annual' ? planInfo.annual : planInfo.monthly
  
  const customDiscountPct = Number(liveInstitute?.settings?.custom_discount_percentage) || 0
  const finalDiscountPct = Math.max(appliedDiscount, customDiscountPct)
  
  const discountVal = (basePrice * finalDiscountPct) / 100
  const subtotalAfterDiscount = Math.max(0, basePrice - discountVal)
  const gstAmount = Number((subtotalAfterDiscount * 0.18).toFixed(2))
  const totalAmountPaid = Number((subtotalAfterDiscount + gstAmount).toFixed(2))

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponMsg(null)
    if (couponCode.toUpperCase() === 'WELCOME20') {
      setAppliedDiscount(20)
      setCouponMsg({ type: 'success', text: 'Coupon WELCOME20 applied! 20% discount added.' })
    } else {
      setCouponMsg({ type: 'error', text: 'Invalid coupon code.' })
    }
  }

  // UPI Payments checkout trigger — opens UPI deeplink + shows QR modal
  const handleUpiPaymentTrigger = () => {
    const platformUpiId = import.meta.env.VITE_UPI_ID || 'coachpro@upi'
    const platformUpiName = 'CoachPro SaaS Billing'
    const tnNote = `CoachPro ${selectedPlan} ${billingCycle}`
    
    // Build UPI deep link (opens GPay / PhonePe / Paytm directly)
    const upiDeepLink = `upi://pay?pa=${encodeURIComponent(platformUpiId)}&pn=${encodeURIComponent(platformUpiName)}&am=${totalAmountPaid}&cu=INR&tn=${encodeURIComponent(tnNote)}`
    
    // Build QR code image from the UPI link using qrserver.com
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&format=svg&data=${encodeURIComponent(upiDeepLink)}`
    
    setUpiQrUrl(qrUrl)
    setUpiDeepLink(upiDeepLink)
    setUpiSubmitStep('pay')
    setUtrInput('')
    setPaidAmountInput('')
    setShowUpiQrModal(true)
    setUpiVerified(false)
    setVerifyingUpi(false)
  }

  // Step 2: User submits UTR after paying
  const handleUtrSubmit = async () => {
    if (!utrInput.trim()) {
      toast.error('Please enter your UTR / Transaction ID from your UPI app.')
      return
    }
    const paid = parseFloat(paidAmountInput)
    if (!paidAmountInput || isNaN(paid) || paid <= 0) {
      toast.error('Please enter the exact amount you paid.')
      return
    }
    setVerifyingUpi(true)
    try {
      const invoiceNo = `INV${Date.now().toString().slice(-8)}`
      const { error } = await supabase.from('payments').insert({
        institute_id: instituteId,
        plan: selectedPlan,
        billing_cycle: billingCycle,
        amount: basePrice,
        gst_amount: gstAmount,
        total_amount: totalAmountPaid,
        paid_amount_claimed: paid,
        method: 'upi',
        status: 'pending',
        utr_number: utrInput.trim(),
        invoice_number: invoiceNo,
        coupon_code: couponCode || null,
        discount_amount: discountVal,
      })
      if (error) throw error
      setUpiSubmitStep('submitted')
      setUpiVerified(true)
      toast.success('Payment submitted! Our team will verify your payment within 2-4 hours and activate your subscription.')
    } catch (err) {
      toast.error(`Submission failed: ${err.message}`)
    } finally {
      setVerifyingUpi(false)
    }
  }

  const processSuccessfulPayment = async (method, paymentTxnId, invoiceNo) => {
    const durationDays = billingCycle === 'annual' ? 365 : 30
    const newExpiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

    // 1. Update institutes table
    await supabase.from('institutes').update({
      subscription_status: 'active',
      plan: selectedPlan,
      subscription_ends_at: newExpiry,
    }).eq('id', instituteId)

    // 2. Record payment in payments table
    await supabase.from('payments').insert({
      institute_id: instituteId,
      plan: selectedPlan,
      billing_cycle: billingCycle,
      amount: basePrice,
      gst_amount: gstAmount,
      total_amount: totalAmountPaid,
      method: method,
      status: 'success',
      razorpay_payment_id: paymentTxnId,
      invoice_number: invoiceNo,
      coupon_code: couponCode || null,
      discount_amount: discountVal,
    })

    // 3. Send WhatsApp confirmation to institute owner
    const ownerPhone = profile?.phone || institute?.phone
    if (ownerPhone) {
      const msg = `✅ Payment Successful!\nWelcome to CoachPro ${selectedPlan.toUpperCase()} Plan. Your subscription is active until ${new Date(newExpiry).toLocaleDateString('en-IN')}.\nInvoice: ${invoiceNo}\n— CoachPro Team`
      await sendWhatsAppMessage(ownerPhone, msg)
    }

    await refreshProfile()
    fetchPaymentHistory()
    toast.success('Payment verified & subscription activated successfully!')
  }

  // Submit Manual UPI for Verification
  const handleUpiSubmit = async (e) => {
    e.preventDefault()
    if (!upiForm.utr.trim()) { toast.warning('Please enter UTR/Transaction ID.'); return }
    setActionLoading(true)
    try {
      const invoiceNo = `INV${Date.now().toString().slice(-8)}`
      const { error: insertErr } = await supabase.from('payments').insert({
        institute_id: instituteId,
        plan: selectedPlan,
        billing_cycle: billingCycle,
        amount: basePrice,
        gst_amount: gstAmount,
        total_amount: totalAmountPaid,
        method: 'upi_manual',
        status: 'pending',
        utr_number: upiForm.utr.trim(),
        screenshot_url: upiForm.screenshot?.trim() || null,
        invoice_number: invoiceNo,
      })

      if (insertErr) throw insertErr

      // Send alert to superadmin
      const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'admin@coachpro.com'
      toast.success('UPI Payment submitted! Our team will verify and activate your subscription within 2-4 hours.')
      fetchPaymentHistory()
    } catch (err) {
      toast.error(`Submission failed: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Invoice PDF Downloader
  const downloadInvoicePDF = (p) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFillColor(30, 58, 138)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('CoachPro', 15, 18)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('TAX INVOICE', 15, 28)

    doc.text('CoachPro Technologies Pvt Ltd', pageWidth - 15, 18, { align: 'right' })
    doc.text('GSTIN: 27AAAAA0000A1Z5', pageWidth - 15, 25, { align: 'right' })

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Invoice No: ${p.invoice_number || 'INV-001'}`, 15, 50)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${new Date(p.created_at).toLocaleDateString('en-IN')}`, 15, 57)

    autoTable(doc, {
      startY: 65,
      head: [['Description', 'Billing Cycle', 'Amount']],
      body: [
        [`CoachPro Subscription (${p.plan?.toUpperCase()} Plan)`, p.billing_cycle || 'monthly', `Rs. ${p.amount}`],
        ['GST (18%)', 'Tax', `Rs. ${p.gst_amount || 0}`],
        ['Total Paid', 'Final', `Rs. ${p.total_amount}`],
      ],
      headStyles: { fillColor: [30, 58, 138] }
    })

    doc.save(`Invoice_${p.invoice_number}.pdf`)
  }

  const currentPlanName = (institute?.plan || 'trial').toUpperCase()
  const expiryDateObj = institute?.subscription_ends_at || institute?.trial_ends_at
  const daysLeft = expiryDateObj ? Math.max(0, Math.ceil((new Date(expiryDateObj) - Date.now()) / (1000 * 60 * 60 * 24))) : 0

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing Management</h1>
        <p className="text-sm text-gray-500">Manage your active subscription plan, billing cycles, online payments, and download tax invoices</p>
      </div>

      {/* Special Discount Banner — shown when superadmin has granted a discount */}
      {customDiscountPct > 0 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-3.5">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <Tag size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-green-800">
              🎉 Special Offer Active — {customDiscountPct}% Discount Applied to Your Account!
            </p>
            <p className="text-xs text-green-600">This exclusive discount has been granted by CoachPro and is automatically applied at checkout.</p>
          </div>
          <div className="ml-auto bg-green-600 text-white text-lg font-extrabold px-4 py-1.5 rounded-xl flex-shrink-0">
            -{customDiscountPct}%
          </div>
        </div>
      )}

      {/* SECTION 1: CURRENT PLAN STATUS CARD */}
      <Card className="p-6 bg-gradient-to-br from-white to-blue-50/40 border border-blue-100 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-gray-900">{currentPlanName} PLAN</h2>
              <StatusBadge status={institute?.subscription_status || 'trial'} />
            </div>
            <p className="text-xs text-gray-600 font-medium">
              Subscription Valid Until: <strong className="text-gray-900">{expiryDateObj ? new Date(expiryDateObj).toLocaleDateString('en-IN') : '—'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl border text-center ${daysLeft < 7 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              <p className="text-[10px] uppercase font-bold">Days Remaining</p>
              <p className="text-xl font-extrabold">{daysLeft} Days</p>
            </div>
            <Button variant="accent" icon={Sparkles} onClick={() => navigate('/pricing')}>
              Upgrade / Change Plan
            </Button>
          </div>
        </div>

        {/* Usage Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div className="space-y-1.5 bg-white p-3 rounded-xl border border-gray-100">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-gray-600">Active Students</span>
              <span className="text-[#1E3A8A]">{usage.students} / {planInfo.students}</span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div className="bg-[#1E3A8A] h-full transition-all" style={{ width: `${Math.min(100, (usage.students / planInfo.students) * 100)}%` }} />
            </div>
          </div>

          <div className="space-y-1.5 bg-white p-3 rounded-xl border border-gray-100">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-gray-600">Batches Configured</span>
              <span className="text-[#F97316]">{usage.batches} / {planInfo.batches}</span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div className="bg-[#F97316] h-full transition-all" style={{ width: `${Math.min(100, (usage.batches / planInfo.batches) * 100)}%` }} />
            </div>
          </div>

          <div className="space-y-1.5 bg-white p-3 rounded-xl border border-gray-100">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-gray-600">Staff Accounts</span>
              <span className="text-green-600">{usage.staff} / {planInfo.staff}</span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div className="bg-green-600 h-full transition-all" style={{ width: `${Math.min(100, (usage.staff / planInfo.staff) * 100)}%` }} />
            </div>
          </div>
        </div>
      </Card>

      {/* SECTION 2: UPGRADE PAYMENT — UPI QR ONLY */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Upgrade via UPI Payment</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 md:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Selected Plan Tier *"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                options={[
                  { value: 'starter', label: 'Starter Plan (₹799/mo)' },
                  { value: 'growth', label: 'Growth Plan (₹1,499/mo)' },
                  { value: 'pro', label: 'Pro Plan (₹2,499/mo)' },
                  { value: 'enterprise', label: 'Enterprise Plan (₹3,999/mo)' },
                ]}
              />
              <Select
                label="Billing Cycle *"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                options={[
                  { value: 'monthly', label: 'Monthly Billing' },
                  { value: 'annual', label: 'Annual Billing (25% OFF)' },
                ]}
              />
            </div>

            {/* Coupon code */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-gray-700">Apply Promo / Coupon Code</label>
              <div className="flex gap-2">
                <Input placeholder="e.g. WELCOME20" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
                <Button variant="outline" onClick={handleApplyCoupon} className="bg-white">Apply</Button>
              </div>
              {couponMsg && (
                <p className={`text-xs font-bold ${couponMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{couponMsg.text}</p>
              )}
            </div>
          </Card>

          {/* Plan Summary Box */}
          <Card className="p-6 bg-gradient-to-br from-slate-900 to-[#1E3A8A] text-white space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="font-bold text-base text-blue-200 border-b border-white/10 pb-2">Order Summary</h3>
              <div className="flex justify-between text-xs">
                <span>{selectedPlan.toUpperCase()} Plan ({billingCycle})</span>
                <span className="font-bold">₹{basePrice.toLocaleString('en-IN')}</span>
              </div>
              {finalDiscountPct > 0 && (
                <div className="flex justify-between text-xs text-green-400 font-bold">
                  <span>{customDiscountPct > appliedDiscount ? 'Special Institute Offer' : 'Coupon Discount'} ({finalDiscountPct}%)</span>
                  <span>-₹{discountVal.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-blue-200">
                <span>GST (18%)</span>
                <span>+₹{gstAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-lg font-extrabold pt-2 border-t border-white/20 text-white">
                <span>Total Amount</span>
                <span>₹{totalAmountPaid.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <Button variant="accent" size="lg" loading={actionLoading} onClick={handleUpiPaymentTrigger} className="w-full shadow-lg">
              Pay via UPI QR Code
            </Button>
          </Card>
        </div>
      </div>

      {/* SECTION 3: PAYMENT HISTORY TABLE */}
      <Card>
        <CardHeader><CardTitle>Payment & Invoice History</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5">Total Paid</th>
                <th className="p-3.5">Method</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paymentsHistory.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">No payment records found.</td></tr>
              ) : paymentsHistory.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-3.5 text-xs text-gray-600">{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="p-3.5 font-mono font-bold text-[#1E3A8A] text-xs">{p.invoice_number || '—'}</td>
                  <td className="p-3.5 font-bold uppercase text-xs text-gray-900">{p.plan}</td>
                  <td className="p-3.5 font-bold text-green-600">₹{(p.total_amount || 0).toLocaleString('en-IN')}</td>
                  <td className="p-3.5 uppercase text-[10px] font-bold text-gray-600">{p.method}</td>
                  <td className="p-3.5"><StatusBadge status={p.status} /></td>
                  <td className="p-3.5 text-right">
                    <Button size="xs" variant="ghost" icon={Download} onClick={() => downloadInvoicePDF(p)}>Invoice</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* UPI QR Payment Modal — 2-step secure flow */}
      {showUpiQrModal && (
        <Modal
          isOpen={true}
          onClose={() => { if (!verifyingUpi && upiSubmitStep !== 'submitted') setShowUpiQrModal(false) }}
          title={upiSubmitStep === 'submitted' ? '✅ Payment Submitted' : upiSubmitStep === 'confirm' ? 'Enter Payment Details' : 'Pay via UPI'}
          size="sm"
          footer={
            upiSubmitStep === 'submitted' ? (
              <Button variant="accent" fullWidth onClick={() => setShowUpiQrModal(false)} icon={CheckCircle2}>
                Done
              </Button>
            ) : upiSubmitStep === 'confirm' ? (
              <div className="flex gap-3 w-full">
                <Button variant="ghost" onClick={() => setUpiSubmitStep('pay')} disabled={verifyingUpi}>
                  ← Back
                </Button>
                <Button variant="accent" fullWidth loading={verifyingUpi} onClick={handleUtrSubmit}>
                  Submit for Verification
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 w-full">
                <Button variant="ghost" onClick={() => setShowUpiQrModal(false)}>Cancel</Button>
                <Button variant="accent" fullWidth onClick={() => setUpiSubmitStep('confirm')} icon={CheckCircle2}>
                  I've Paid — Enter UTR
                </Button>
              </div>
            )
          }
        >
          {/* STEP 1: Pay — show QR + deeplink */}
          {upiSubmitStep === 'pay' && (
            <div className="space-y-4 p-2">
              <div className="bg-[#1E3A8A] text-white rounded-2xl p-4 text-center">
                <p className="text-xs text-blue-200 font-semibold uppercase tracking-wider">Amount to Pay</p>
                <p className="text-3xl font-extrabold mt-1">₹{totalAmountPaid.toLocaleString('en-IN')}</p>
                <p className="text-xs text-blue-200 mt-1">{selectedPlan.toUpperCase()} Plan · {billingCycle} · incl. 18% GST</p>
              </div>

              <a
                href={upiDeepLink}
                className="flex items-center justify-center gap-3 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 px-4 rounded-2xl transition-colors text-sm shadow-md"
              >
                <QrCode size={20} />
                Open UPI App (GPay / PhonePe / Paytm)
              </a>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium flex-shrink-0">or scan QR code</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="flex flex-col items-center">
                <div className="bg-white p-3 border-2 border-gray-100 rounded-2xl shadow-sm">
                  <img
                    src={upiQrUrl}
                    alt="UPI QR Code"
                    className="w-48 h-48"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Scan with GPay, PhonePe, Paytm, BHIM or any UPI app</p>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">UPI ID:</span>
                  <span className="font-bold text-[#1E3A8A] select-all">{import.meta.env.VITE_UPI_ID || 'coachpro@upi'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Name:</span>
                  <span className="font-bold text-gray-800">CoachPro SaaS Billing</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="font-extrabold text-green-600">₹{totalAmountPaid.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <p className="text-[10px] text-gray-500 text-center">
                After paying, click <strong>"I've Paid — Enter UTR"</strong> below to submit your transaction ID for verification.
              </p>
            </div>
          )}

          {/* STEP 2: Confirm — enter UTR + amount */}
          {upiSubmitStep === 'confirm' && (
            <div className="space-y-4 p-2">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-bold mb-1">Payment Verification Required</p>
                  <p>Enter the <strong>exact UTR number</strong> from your UPI app and the <strong>exact amount you paid</strong>. Our team will verify this against bank records within 2–4 hours.</p>
                  <p className="mt-1 font-bold text-amber-700">⚠️ Wrong amount = subscription will NOT be activated.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  UTR / Transaction Reference ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 412839029341 (12-digit number from your UPI app)"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30"
                />
                <p className="text-[10px] text-gray-400">Find this in your UPI app → Transaction History → Transaction ID / UTR</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  Amount You Paid (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder={`Should be ₹${totalAmountPaid}`}
                  value={paidAmountInput}
                  onChange={(e) => setPaidAmountInput(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30"
                />
                {paidAmountInput && parseFloat(paidAmountInput) !== totalAmountPaid && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                    <AlertTriangle size={12} /> Expected ₹{totalAmountPaid} — Amount mismatch may delay activation
                  </p>
                )}
                {paidAmountInput && parseFloat(paidAmountInput) === totalAmountPaid && (
                  <p className="text-[11px] text-green-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> Amount matches — great!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Submitted */}
          {upiSubmitStep === 'submitted' && (
            <div className="text-center p-6 space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">Payment Submitted!</h3>
                <p className="text-sm text-gray-500 mt-1">Your payment details have been received. Our team will verify your UPI transaction within <strong>2–4 hours</strong> and activate your subscription.</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-left text-xs space-y-1.5 font-mono">
                <div className="flex justify-between"><span className="text-gray-400">UTR:</span><span className="font-bold text-gray-800">{utrInput}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Amount Claimed:</span><span className="font-bold text-green-600">₹{paidAmountInput}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Status:</span><span className="font-bold text-amber-600">Pending Verification</span></div>
              </div>
              <p className="text-[10px] text-gray-400">You'll receive a WhatsApp confirmation once verified. Contact support if not activated within 4 hours.</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
