import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { 
  AlertTriangle, Lock, CheckCircle2, MessageSquare, PhoneCall, LogOut, 
  ShieldOff, CreditCard, Tag 
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'
import { sendWhatsAppMessage } from '../../lib/wati'

export default function Expired() {
  const { user, institute, signOut } = useAuth()
  const toast = useToast()
  
  const supportPhone = import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER || '919876543210'
  const instituteName = institute?.name || 'My Institute'
  const isSuspended = institute?.subscription_status === 'suspended'
  const instituteId = institute?.id

  // Profile data
  const [profile, setProfile] = useState(null)
  
  // Billing selection states
  const [selectedPlan, setSelectedPlan] = useState('growth')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [couponCode, setCouponCode] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [usage, setUsage] = useState({ students: 0, batches: 0, staff: 0 })

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return
      try {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
        if (data) setProfile(data)
      } catch (err) {
        console.error('Failed to fetch user profile:', err)
      }
    }
    fetchProfile()
  }, [user?.id])

  useEffect(() => {
    const fetchUsage = async () => {
      if (!instituteId) return
      try {
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
      } catch (err) {
        console.error('Failed to fetch usage stats:', err)
      }
    }
    fetchUsage()
  }, [instituteId])

  const planInfo = {
    starter: { name: 'Starter', limit: '150 students', monthly: 799, annual: 599 },
    growth: { name: 'Growth', limit: '400 students', monthly: 1499, annual: 999 },
    pro: { name: 'Pro', limit: '1000 students', monthly: 2499, annual: 1999 },
    enterprise: { name: 'Enterprise', limit: 'Unlimited students', monthly: 3999, annual: 2999 },
  }

  // Cost calculations
  const basePrice = planInfo[selectedPlan][billingCycle] * (billingCycle === 'annual' ? 12 : 1)
  const discountVal = Math.round((basePrice * appliedDiscount) / 100)
  const totalAmountPaid = basePrice - discountVal

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return
    setCouponMsg(null)
    if (couponCode.toUpperCase() === 'WELCOME20') {
      setAppliedDiscount(20)
      setCouponMsg({ type: 'success', text: 'Coupon WELCOME20 applied! 20% discount added.' })
    } else {
      setCouponMsg({ type: 'error', text: 'Invalid coupon code.' })
    }
  }

  const lastActive = institute?.subscription_ends_at || institute?.trial_ends_at || new Date().toISOString()
  const formattedLastActive = new Date(lastActive).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  const whatsappMessage = isSuspended
    ? encodeURIComponent(`Hi, my Batch Desk account for ${instituteName} has been suspended. I'd like to understand why and resolve the issue.`)
    : encodeURIComponent(`Hi, I want to renew my Batch Desk subscription for ${instituteName}`)
  const whatsappUrl = `https://wa.me/${supportPhone}?text=${whatsappMessage}`

  const features = [
    'Complete Student & Admission Management',
    'Automated Fee Collection & PDF Receipts',
    'Attendance Tracking & WhatsApp Notifications',
    'Class Timetable & Exam Announcements',
    'Detailed Financial & Growth Analytics',
  ]

  // PDF Receipt Generator
  const downloadInvoicePDF = (p, currentProfile) => {
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
    doc.text(currentProfile?.name || institute?.name || 'Valued Client', 120, 53)
    doc.text(user?.email || '', 120, 58)
    if (currentProfile?.phone || institute?.phone) {
      doc.text(`Phone: ${currentProfile?.phone || institute?.phone}`, 120, 63)
    }

    doc.setDrawColor(226, 232, 240)
    doc.line(15, 68, pageWidth - 15, 68)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Receipt No: ${p.invoice_number || 'INV-001'}`, 15, 78)
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

    const finalY = doc.lastAutoTable.finalY + 15
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text('Thank you for choosing Batch Desk! Welcome aboard.', pageWidth / 2, finalY, { align: 'center' })

    doc.save(`Invoice_${p.invoice_number}.pdf`)
  }

  // Process Renewal
  const processRenewal = async (paymentTxnId, invoiceNo) => {
    const durationDays = billingCycle === 'annual' ? 365 : 30
    const newExpiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

    // 1. Update status
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
      gst_amount: 0,
      total_amount: totalAmountPaid,
      method: 'razorpay',
      status: 'success',
      razorpay_payment_id: paymentTxnId,
      invoice_number: invoiceNo,
      coupon_code: couponCode || null,
      discount_amount: discountVal,
      created_at: new Date().toISOString()
    }

    // 2. Insert record
    const { error: insertErr } = await supabase.from('payments').insert(paymentRecord)
    if (insertErr) throw insertErr

    // 3. WhatsApp notification
    const ownerPhone = profile?.phone || institute?.phone
    if (ownerPhone) {
      const msg = `✅ Renewal Successful!\nWelcome back to Batch Desk ${selectedPlan.toUpperCase()} Plan. Your subscription is active until ${new Date(newExpiry).toLocaleDateString('en-IN')}.\nInvoice: ${invoiceNo}\n— Batch Desk Team`
      await sendWhatsAppMessage(ownerPhone, msg)
    }

    toast.success('Renewal successful! Your account is unlocked.')
    downloadInvoicePDF(paymentRecord, profile)

    // Force reload window to dashboard to clear subscription guard session state
    setTimeout(() => {
      window.location.href = '/dashboard'
    }, 1500)
  }

  // Razorpay trigger
  const handleRazorpayRenewal = () => {
    setActionLoading(true)
    if (!window.Razorpay) {
      toast.error('Razorpay SDK failed to load. Please check your internet connection and try again.')
      setActionLoading(false)
      return
    }

    try {
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount: Math.round(totalAmountPaid * 100),
        currency: 'INR',
        name: 'Batch Desk',
        description: `Renewal: ${selectedPlan?.toUpperCase()} Plan (${billingCycle})`,
        image: '/logo.png',
        handler: async function (response) {
          setActionLoading(true)
          try {
            const paymentId = response.razorpay_payment_id
            const invoiceNo = `INV${Date.now().toString().slice(-8)}`
            await processRenewal(paymentId, invoiceNo)
          } catch (err) {
            toast.error(`Renewal failed: ${err.message}`)
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
      toast.error(`Razorpay checkout initialization failed: ${err.message}`)
      setActionLoading(false)
    }
  }

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-red-100 p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <ShieldOff size={32} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
            Account Suspended
          </h1>

          <p className="text-gray-500 text-sm mb-6">
            Access for <strong className="text-gray-800">{instituteName}</strong> has been suspended by the Batch Desk platform administrator. Please contact support to understand and resolve this issue.
          </p>

          <div className="bg-red-50 rounded-2xl p-5 mb-8 text-left border border-red-100">
            <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">What this means:</p>
            <ul className="space-y-2 text-sm text-red-800">
              <li>• Your data is safely preserved and has not been deleted</li>
              <li>• Access has been restricted by the platform team</li>
              <li>• Contact support to resolve compliance or billing issues</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center mb-6">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button variant="accent" size="lg" fullWidth icon={MessageSquare}>
                Contact Support via WhatsApp
              </Button>
            </a>
            <a href={`tel:+${supportPhone}`} className="w-full sm:w-auto">
              <Button variant="outline" size="lg" fullWidth icon={PhoneCall}>
                Call Support
              </Button>
            </a>
          </div>

          <button onClick={signOut} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <LogOut size={16} />
            Sign out of account
          </button>
        </div>
      </div>
    )
  }

  // Default: Subscription expired - Render a beautiful grid of plans + Razorpay checkout
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 bg-rose-50 text-rose-600 rounded-3xl border border-rose-100 shadow-xs mb-2">
            <Lock size={28} className="animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Your Account is Locked</h1>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            The subscription for <span className="font-bold text-gray-800">{instituteName}</span> expired on <span className="font-semibold text-gray-700">{formattedLastActive}</span>. Renew below to restore instant workspace access.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT SIDEBAR: Lock alert + Features */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 border border-gray-150 bg-white space-y-5 rounded-3xl">
              <div>
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider text-[11px] border-b pb-2 mb-3">All your data is safe</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Admissions, courses, fee structures, and attendance records are fully preserved. Renewing your subscription immediately unlocks full access.
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Features included in all plans:</span>
                <ul className="space-y-2.5">
                  {features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-700 font-semibold">
                      <CheckCircle2 size={15} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-gray-100 text-center space-y-3">
                <p className="text-xs text-gray-450 font-medium">Need custom quotes or billing help?</p>
                <div className="flex flex-col gap-2">
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button variant="outline" size="sm" fullWidth icon={MessageSquare} className="text-xs bg-white">
                      Chat on WhatsApp
                    </Button>
                  </a>
                  <a href={`tel:+${supportPhone}`} className="w-full">
                    <Button variant="ghost" size="sm" fullWidth icon={PhoneCall} className="text-xs text-gray-500">
                      Call Support
                    </Button>
                  </a>
                </div>
              </div>
            </Card>

            <div className="text-center">
              <button onClick={signOut} className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 font-bold uppercase tracking-wider transition-colors">
                <LogOut size={14} />
                Sign out of account
              </button>
            </div>
          </div>

          {/* RIGHT SIDE: Plan Selection, Cycle, Coupon & Razorpay Pay */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Cycle Selector toggle switch */}
            <div className="flex justify-between items-center bg-white border border-gray-150 p-4 rounded-3xl shadow-xs">
              <div>
                <p className="text-xs font-bold text-gray-900">Billing Cycle Selection</p>
                <p className="text-[10px] text-gray-400">Save up to 25% on annual billing cycles</p>
              </div>
              <div className="flex bg-gray-100 p-0.5 rounded-xl border">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${billingCycle === 'annual' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  Annual (25% Off)
                </button>
              </div>
            </div>

            {/* Plans List Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* STARTER CARD */}
              <div
                onClick={() => setSelectedPlan('starter')}
                className={`cursor-pointer p-5 rounded-3xl border-2 transition-all space-y-2 flex flex-col justify-between hover:shadow-md ${
                  selectedPlan === 'starter'
                    ? 'border-[#1E3A8A] bg-blue-50/20 ring-2 ring-blue-500/10 shadow-xs'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-gray-900 text-xs tracking-wider uppercase">STARTER</span>
                    {selectedPlan === 'starter' && <span className="bg-[#1E3A8A] text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full">ACTIVE</span>}
                  </div>
                  <p className="text-[10px] text-gray-400">Up to 150 students</p>
                  <div className="pt-2">
                    <span className="text-xl font-extrabold text-gray-900">₹{billingCycle === 'annual' ? '599' : '799'}</span>
                    <span className="text-gray-500 text-xs">/mo</span>
                    {billingCycle === 'annual' && <p className="text-[9px] text-green-600 font-bold">billed ₹7,188/yr</p>}
                  </div>
                </div>
              </div>

              {/* GROWTH CARD */}
              <div
                onClick={() => setSelectedPlan('growth')}
                className={`cursor-pointer p-5 rounded-3xl border-2 transition-all space-y-2 flex flex-col justify-between hover:shadow-md ${
                  selectedPlan === 'growth'
                    ? 'border-[#1E3A8A] bg-blue-50/20 ring-2 ring-blue-500/10 shadow-xs'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-gray-900 text-xs tracking-wider uppercase">GROWTH</span>
                    {selectedPlan === 'growth' && <span className="bg-[#1E3A8A] text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full">ACTIVE</span>}
                  </div>
                  <p className="text-[10px] text-gray-400">Up to 400 students</p>
                  <div className="pt-2">
                    <span className="text-xl font-extrabold text-gray-900">₹{billingCycle === 'annual' ? '999' : '1,499'}</span>
                    <span className="text-gray-500 text-xs">/mo</span>
                    {billingCycle === 'annual' && <p className="text-[9px] text-green-600 font-bold">billed ₹11,988/yr</p>}
                  </div>
                </div>
              </div>

              {/* PRO CARD */}
              <div
                onClick={() => setSelectedPlan('pro')}
                className={`cursor-pointer p-5 rounded-3xl border-2 transition-all space-y-2 flex flex-col justify-between hover:shadow-md ${
                  selectedPlan === 'pro'
                    ? 'border-[#1E3A8A] bg-blue-50/20 ring-2 ring-blue-500/10 shadow-xs'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-gray-900 text-xs tracking-wider uppercase">PRO</span>
                    {selectedPlan === 'pro' && <span className="bg-[#1E3A8A] text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full">ACTIVE</span>}
                  </div>
                  <p className="text-[10px] text-gray-400">Up to 1000 students</p>
                  <div className="pt-2">
                    <span className="text-xl font-extrabold text-gray-900">₹{billingCycle === 'annual' ? '1,999' : '2,499'}</span>
                    <span className="text-gray-500 text-xs">/mo</span>
                    {billingCycle === 'annual' && <p className="text-[9px] text-green-600 font-bold">billed ₹23,988/yr</p>}
                  </div>
                </div>
              </div>

              {/* ENTERPRISE CARD */}
              <div
                onClick={() => setSelectedPlan('enterprise')}
                className={`cursor-pointer p-5 rounded-3xl border-2 transition-all space-y-2 flex flex-col justify-between hover:shadow-md ${
                  selectedPlan === 'enterprise'
                    ? 'border-[#1E3A8A] bg-blue-50/20 ring-2 ring-blue-500/10 shadow-xs'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-gray-900 text-xs tracking-wider uppercase">ENTERPRISE</span>
                    {selectedPlan === 'enterprise' && <span className="bg-[#1E3A8A] text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full">ACTIVE</span>}
                  </div>
                  <p className="text-[10px] text-gray-400">Unlimited students</p>
                  <div className="pt-2">
                    <span className="text-xl font-extrabold text-gray-900">₹{billingCycle === 'annual' ? '2,999' : '3,999'}</span>
                    <span className="text-gray-500 text-xs">/mo</span>
                    {billingCycle === 'annual' && <p className="text-[9px] text-green-600 font-bold">billed ₹35,988/yr</p>}
                  </div>
                </div>
              </div>

            </div>

            {/* Billing Summary Box */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Promo input */}
              <Card className="p-6 md:col-span-2 space-y-4 rounded-3xl">
                <div className="space-y-1.5">
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

              {/* Order total checkout */}
              <Card className="p-6 bg-gradient-to-br from-slate-900 to-[#1E3A8A] text-white space-y-4 rounded-3xl flex flex-col justify-between">
                <div className="space-y-3">
                  <h3 className="font-bold text-base text-blue-200 border-b border-white/10 pb-2">Order Summary</h3>
                  <div className="flex justify-between text-xs">
                    <span>{selectedPlan.toUpperCase()} Plan</span>
                    <span className="font-bold">₹{basePrice.toLocaleString('en-IN')}</span>
                  </div>
                  {appliedDiscount > 0 && (
                    <div className="flex justify-between text-xs text-green-400 font-bold">
                      <span>Discount ({appliedDiscount}%)</span>
                      <span>-₹{discountVal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-blue-200">
                    <span>GST (inclusive)</span>
                    <span>₹0.00</span>
                  </div>
                  <div className="flex justify-between text-lg font-extrabold pt-2 border-t border-white/20 text-white">
                    <span>Total Amount</span>
                    <span>₹{totalAmountPaid.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <Button variant="accent" size="lg" loading={actionLoading} onClick={handleRazorpayRenewal} className="w-full shadow-lg">
                  💳 Renew Account
                </Button>
              </Card>

            </div>

          </div>

        </div>
        
      </div>
    </div>
  )
}
