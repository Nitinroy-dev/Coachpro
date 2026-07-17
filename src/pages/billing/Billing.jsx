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

  // Razorpay Checkout Trigger
  const handleRazorpayCheckout = () => {
    setActionLoading(true)
    if (!window.Razorpay) {
      toast.error('Razorpay SDK failed to load. Please check your internet connection or try again.')
      setActionLoading(false)
      return
    }

    try {
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount: Math.round(totalAmountPaid * 100), // Razorpay expects amount in paise
        currency: 'INR',
        name: 'Batch Desk',
        description: `Subscription: ${selectedPlan?.toUpperCase()} Plan (${billingCycle})`,
        image: '/logo.png',
        handler: async function (response) {
          setActionLoading(true)
          try {
            const paymentId = response.razorpay_payment_id
            const invoiceNo = `INV${Date.now().toString().slice(-8)}`
            await processSuccessfulPayment('razorpay', paymentId, invoiceNo)
          } catch (err) {
            toast.error(`Payment processing failed: ${err.message}`)
          } finally {
            setActionLoading(false)
          }
        },
        prefill: {
          name: profile?.name || '',
          email: user?.email || '',
          contact: profile?.phone || '',
        },
        notes: {
          institute_id: instituteId,
          plan: selectedPlan,
          billing_cycle: billingCycle,
        },
        theme: {
          color: '#1E3A8A',
        },
        modal: {
          ondismiss: function () {
            setActionLoading(false)
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (resp) {
        toast.error(`Payment failed: ${resp.error.description}`)
        setActionLoading(false)
      })
      rzp.open()
    } catch (err) {
      toast.error(`Razorpay load error: ${err.message}`)
      setActionLoading(false)
    }
  }

  const processSuccessfulPayment = async (method, paymentTxnId, invoiceNo) => {
    const durationDays = billingCycle === 'annual' ? 365 : 30
    const newExpiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

    // 1. Update institutes table
    const { error: updateErr } = await supabase.from('institutes').update({
      subscription_status: 'active',
      plan: selectedPlan,
      subscription_ends_at: newExpiry,
    }).eq('id', instituteId)

    if (updateErr) throw updateErr

    const paymentRecord = {
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
      created_at: new Date().toISOString()
    }

    // 2. Record payment in payments table
    const { error: insertErr } = await supabase.from('payments').insert(paymentRecord)
    if (insertErr) throw insertErr

    // 3. Send WhatsApp confirmation to institute owner
    const ownerPhone = profile?.phone || institute?.phone
    if (ownerPhone) {
      const msg = `✅ Payment Successful!\nWelcome to Batch Desk ${selectedPlan.toUpperCase()} Plan. Your subscription is active until ${new Date(newExpiry).toLocaleDateString('en-IN')}.\nInvoice: ${invoiceNo}\n— Batch Desk Team`
      await sendWhatsAppMessage(ownerPhone, msg)
    }

    await refreshProfile()
    fetchPaymentHistory()
    toast.success('Payment verified & subscription activated successfully!')
    
    // Auto-trigger invoice receipt download
    downloadInvoicePDF(paymentRecord)
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
    doc.text('Batch Desk', 15, 18)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('PAYMENT RECEIPT', 15, 28)

    doc.text('Batch Desk', pageWidth - 15, 18, { align: 'right' })

    // Billed From / Company Details
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Seller Details:', 15, 48)
    doc.setFont('helvetica', 'normal')
    doc.text('Batch Desk', 15, 53)
    doc.text('Email: support@batchdesk.com', 15, 58)

    // Billed To / Client Details
    doc.setFont('helvetica', 'bold')
    doc.text('Billed To:', 120, 48)
    doc.setFont('helvetica', 'normal')
    doc.text(profile?.name || institute?.name || 'Valued Client', 120, 53)
    doc.text(user?.email || '', 120, 58)
    if (profile?.phone || institute?.phone) {
      doc.text(`Phone: ${profile?.phone || institute?.phone}`, 120, 63)
    }

    doc.setDrawColor(226, 232, 240)
    doc.line(15, 68, pageWidth - 15, 68)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Invoice No: ${p.invoice_number || 'INV-001'}`, 15, 78)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${new Date(p.created_at).toLocaleDateString('en-IN')}`, 15, 83)
    doc.text(`Payment Method: ${p.method?.toUpperCase() || 'Razorpay'}`, 120, 78)
    doc.text(`Transaction ID: ${p.razorpay_payment_id || p.utr_number || 'N/A'}`, 120, 83)

    const totalCost = Number(p.total_amount) || 0
    const discountAmt = Number(p.discount_amount) || 0

    const tableBody = [
      [`Batch Desk Subscription (${p.plan?.toUpperCase()} Plan)`, p.billing_cycle || 'monthly', `Rs. ${totalCost.toFixed(2)}`],
    ]

    if (discountAmt > 0) {
      const originalCost = totalCost + discountAmt
      tableBody[0] = [`Batch Desk Subscription (${p.plan?.toUpperCase()} Plan)`, p.billing_cycle || 'monthly', `Rs. ${originalCost.toFixed(2)}`]
      tableBody.push([`Promo Discount (${p.coupon_code || 'Applied'})`, 'Discount', `-Rs. ${discountAmt.toFixed(2)}`])
    }

    tableBody.push(
      ['Total Paid Amount', 'Final', `Rs. ${totalCost.toFixed(2)}`]
    )

    autoTable(doc, {
      startY: 92,
      head: [['Description', 'Billing Cycle / Category', 'Amount']],
      body: tableBody,
      headStyles: { fillColor: [30, 58, 138] },
      columnStyles: {
        2: { halign: 'right' }
      }
    })

    // Add footer thank you note
    const finalY = doc.lastAutoTable.finalY + 15
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text('Thank you for choosing Batch Desk! Welcome aboard.', pageWidth / 2, finalY, { align: 'center' })

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

      {/* SECTION 2: CHOOSE SUBSCRIPTION PLAN */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Choose Subscription Plan</h2>
            <p className="text-xs text-gray-500">Select a tier below. Pricing scales with student size and feature sets.</p>
          </div>
          {/* Billing cycle switch inside choose plan */}
          <div className="flex items-center gap-3 bg-gray-100 p-1.5 rounded-xl text-xs font-bold w-fit border border-gray-200/50">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${billingCycle === 'annual' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Annual <span className="bg-green-100 text-green-700 font-extrabold text-[9px] px-1.5 py-0.5 rounded-full uppercase">25% OFF</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Starter */}
          <div
            onClick={() => setSelectedPlan('starter')}
            className={`cursor-pointer p-5 rounded-3xl border-2 transition-all space-y-3 flex flex-col justify-between hover:shadow-md ${
              selectedPlan === 'starter'
                ? 'border-[#1E3A8A] bg-blue-50/20 ring-2 ring-blue-500/10 shadow-xs'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="font-extrabold text-gray-900 text-sm tracking-wide">STARTER</span>
                {selectedPlan === 'starter' && <span className="bg-[#1E3A8A] text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">Selected</span>}
              </div>
              <p className="text-gray-500 text-[11px]">Best for small tuitions</p>
              <div className="pt-1">
                <span className="text-2xl font-extrabold text-gray-900">₹{billingCycle === 'annual' ? '599' : '799'}</span>
                <span className="text-gray-500">/mo</span>
                {billingCycle === 'annual' && <p className="text-[9px] text-green-600 font-bold">billed ₹7,190/yr</p>}
              </div>
              <ul className="space-y-1.5 pt-2 border-t border-gray-100 text-gray-600 font-medium">
                <li>👥 Up to 150 Students</li>
                <li>📚 Up to 8 Batches</li>
                <li>👨‍🏫 2 Staff Accounts</li>
                <li>📧 Email support</li>
                <li className="text-[10px] text-gray-400 line-through">💬 WhatsApp automated alerts</li>
              </ul>
            </div>
          </div>

          {/* Card 2: Growth */}
          <div
            onClick={() => setSelectedPlan('growth')}
            className={`cursor-pointer p-5 rounded-3xl border-2 transition-all space-y-3 flex flex-col justify-between hover:shadow-md ${
              selectedPlan === 'growth'
                ? 'border-[#1E3A8A] bg-blue-50/20 ring-2 ring-blue-500/10 shadow-xs'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="font-extrabold text-gray-900 text-sm tracking-wide flex items-center gap-1">GROWTH 🚀</span>
                {selectedPlan === 'growth' && <span className="bg-[#1E3A8A] text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">Selected</span>}
              </div>
              <p className="text-gray-500 text-[11px]">Best for coaching centers</p>
              <div className="pt-1">
                <span className="text-2xl font-extrabold text-gray-900">₹{billingCycle === 'annual' ? '1,124' : '1,499'}</span>
                <span className="text-gray-500">/mo</span>
                {billingCycle === 'annual' && <p className="text-[9px] text-green-600 font-bold">billed ₹13,490/yr</p>}
              </div>
              <ul className="space-y-1.5 pt-2 border-t border-gray-100 text-gray-700 font-extrabold">
                <li>👥 Up to 400 Students</li>
                <li>📚 Up to 20 Batches</li>
                <li>👨‍🏫 6 Staff Accounts</li>
                <li className="text-[#F97316]">📢 WhatsApp Auto Alerts</li>
                <li>💳 UPI QR payments</li>
                <li>📅 Institute Calendar</li>
              </ul>
            </div>
          </div>

          {/* Card 3: Pro */}
          <div
            onClick={() => setSelectedPlan('pro')}
            className={`cursor-pointer p-5 rounded-3xl border-2 transition-all space-y-3 flex flex-col justify-between hover:shadow-md ${
              selectedPlan === 'pro'
                ? 'border-[#1E3A8A] bg-blue-50/20 ring-2 ring-blue-500/10 shadow-xs'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="font-extrabold text-gray-900 text-sm tracking-wide flex items-center gap-1">PRO ⭐</span>
                {selectedPlan === 'pro' && <span className="bg-[#1E3A8A] text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">Selected</span>}
              </div>
              <p className="text-gray-500 text-[11px]">For established institutes</p>
              <div className="pt-1">
                <span className="text-2xl font-extrabold text-gray-900">₹{billingCycle === 'annual' ? '1,874' : '2,499'}</span>
                <span className="text-gray-500">/mo</span>
                {billingCycle === 'annual' && <p className="text-[9px] text-green-600 font-bold">billed ₹22,490/yr</p>}
              </div>
              <ul className="space-y-1.5 pt-2 border-t border-gray-100 text-gray-700 font-extrabold">
                <li>👥 Up to 1,000 Students</li>
                <li>📚 Unlimited Batches</li>
                <li>👨‍🏫 15 Staff Accounts</li>
                <li className="text-[#1E3A8A]">🎨 Custom branding & Logo</li>
                <li className="text-[#1E3A8A]">👤 Student/Parent portals</li>
                <li>📞 Priority support</li>
              </ul>
            </div>
          </div>

          {/* Card 4: Enterprise */}
          <div
            onClick={() => setSelectedPlan('enterprise')}
            className={`cursor-pointer p-5 rounded-3xl border-2 transition-all space-y-3 flex flex-col justify-between hover:shadow-md ${
              selectedPlan === 'enterprise'
                ? 'border-[#1E3A8A] bg-blue-50/20 ring-2 ring-blue-500/10 shadow-xs'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="font-extrabold text-gray-900 text-sm tracking-wide">ENTERPRISE</span>
                {selectedPlan === 'enterprise' && <span className="bg-[#1E3A8A] text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">Selected</span>}
              </div>
              <p className="text-gray-500 text-[11px]">For chains & franchises</p>
              <div className="pt-1">
                <span className="text-2xl font-extrabold text-gray-900">₹{billingCycle === 'annual' ? '2,999' : '3,999'}</span>
                <span className="text-gray-500">/mo</span>
                {billingCycle === 'annual' && <p className="text-[9px] text-green-600 font-bold">billed ₹35,990/yr</p>}
              </div>
              <ul className="space-y-1.5 pt-2 border-t border-gray-100 text-gray-650 font-bold">
                <li>👥 Unlimited Students</li>
                <li>🏢 Unlimited Branches</li>
                <li>💼 Dedicated Account Manager</li>
                <li>🔌 API integrations</li>
                <li>📊 SLA & Uptime guarantee</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CHECKOUT & PAYMENT */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Secure Checkout</h2>
        <p className="text-xs text-gray-500 -mt-2">Pay instantly via Razorpay (supports Credit/Debit Cards, UPI, Netbanking, and Wallets)</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 md:col-span-2 space-y-4">
            {/* Selected Plan Summary Row */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Selected Subscription</p>
                <p className="text-base font-extrabold text-gray-900 capitalize">{selectedPlan} Plan ({billingCycle})</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Standard Price</p>
                <p className="text-lg font-extrabold text-[#1E3A8A]">₹{basePrice.toLocaleString('en-IN')}</p>
              </div>
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

            {/* Warning if current usage exceeds selected plan limit */}
            {usage && (
              (() => {
                const numericLimit = selectedPlan === 'starter' ? 150 : selectedPlan === 'growth' ? 400 : selectedPlan === 'pro' ? 1000 : 999999
                const isExceeded = usage.students > numericLimit
                if (isExceeded) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-800 text-xs">
                      <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold mb-1">⚠️ Plan Limit Exceeded Notice</p>
                        <p>You have <strong>{usage.students} active students</strong>, which exceeds the <strong>{numericLimit} students</strong> limit of the <strong>{selectedPlan.toUpperCase()}</strong> plan.</p>
                        <p className="mt-1">You can renew under this plan, but you won't be able to add any new students until you upgrade or archive/delete existing student accounts.</p>
                      </div>
                    </div>
                  )
                }
                return null
              })()
            )}
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
                <span>GST (18% inclusive)</span>
                <span>+₹{gstAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-lg font-extrabold pt-2 border-t border-white/20 text-white">
                <span>Total Amount</span>
                <span>₹{totalAmountPaid.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <Button variant="accent" size="lg" loading={actionLoading} onClick={handleRazorpayCheckout} className="w-full shadow-lg">
              💳 Pay Securely with Razorpay
            </Button>
          </Card>
        </div>
      </div>

      {/* SECTION 3: PAYMENT HISTORY TABLE */}
      <Card>
        <CardHeader><CardTitle>Payment & Receipt History</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Receipt #</th>
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
                    <Button size="xs" variant="ghost" icon={Download} onClick={() => downloadInvoicePDF(p)}>Receipt</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
