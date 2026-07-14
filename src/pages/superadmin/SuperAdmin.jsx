import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { sendWhatsAppMessage } from '../../lib/wati'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge, { StatusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import { Building2, ShieldCheck, RefreshCw, Eye, CheckCircle, Clock, AlertOctagon, Ban, CreditCard, Tag, TrendingUp, Check, X } from 'lucide-react'

export default function SuperAdmin() {
  const { user } = useAuth()
  const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'admin@batchdesk.com'
  const isSuperAdmin = user?.email && user.email.toLowerCase() === superadminEmail.toLowerCase()

  const [activeTab, setActiveTab] = useState('institutes') // institutes | payments | coupons | revenue
  const [loading, setLoading] = useState(true)

  // Datasets
  const [institutes, setInstitutes] = useState([])
  const [payments, setPayments] = useState([])
  const [coupons, setCoupons] = useState([])

  // Modal states
  const [selectedInst, setSelectedInst] = useState(null)
  const [selectedPaymentVerify, setSelectedPaymentVerify] = useState(null)
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [selectedInstForSubscription, setSelectedInstForSubscription] = useState(null)
  const [subForm, setSubForm] = useState({
    plan: 'growth',
    status: 'active',
    expires_at: ''
  })

  // Coupon form
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    max_uses: '100',
  })

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSuperadminData()
    }
  }, [isSuperAdmin, activeTab])

  const fetchSuperadminData = async () => {
    setLoading(true)
    try {
      const [instRes, payRes, coupRes] = await Promise.all([
        supabase.from('institutes').select('*, users(id, name, phone, role)').order('created_at', { ascending: false }),
        supabase.from('payments').select('*, institutes(name, phone)').order('created_at', { ascending: false }),
        supabase.from('coupons').select('*').order('created_at', { ascending: false })
      ])

      const filteredInsts = (instRes.data || []).filter(inst => {
        const usersArray = Array.isArray(inst.users) ? inst.users : (inst.users ? [inst.users] : [])
        const hasSuperadmin = usersArray.some(u => u.id === user?.id)
        return !hasSuperadmin
      })

      setInstitutes(filteredInsts)
      setPayments(payRes.data || [])
      setCoupons(coupRes.data || [])
    } catch (err) {
      console.error('Superadmin fetch error:', err)
    } finally {
      setLoading(false)
    }
  }



  // Offer Custom Discount to Specific Institute
  const handleOfferDiscount = async (inst) => {
    const currentDiscount = inst.settings?.custom_discount_percentage || '0'
    const pctStr = window.prompt(`Enter custom discount percentage (0 to 100) for ${inst.name}:`, currentDiscount)
    if (pctStr === null) return
    const pct = parseInt(pctStr, 10)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      alert('Invalid percentage value. Must be between 0 and 100.')
      return
    }

    try {
      const updatedSettings = {
        ...(inst.settings || {}),
        custom_discount_percentage: pct
      }
      const { error } = await supabase
        .from('institutes')
        .update({ settings: updatedSettings })
        .eq('id', inst.id)

      if (error) throw error
      alert(`Applied ${pct}% custom discount to ${inst.name}!`)
      fetchSuperadminData()
    } catch (err) {
      alert(`Failed to save discount: ${err.message}`)
    }
  }

  const handleOpenSubscriptionModal = (inst) => {
    setSelectedInstForSubscription(inst)
    const currentExpiry = inst.subscription_ends_at || inst.trial_ends_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    setSubForm({
      plan: inst.plan || 'starter',
      status: inst.subscription_status || 'trial',
      expires_at: currentExpiry.split('T')[0]
    })
  }

  const setExpiryDays = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setSubForm(prev => ({ ...prev, expires_at: d.toISOString().split('T')[0] }))
  }

  const handleSaveSubscription = async () => {
    if (!selectedInstForSubscription) return
    setLoading(true)
    try {
      const payload = {
        plan: subForm.plan,
        subscription_status: subForm.status,
      }

      if (subForm.status === 'trial') {
        payload.trial_ends_at = new Date(subForm.expires_at + 'T23:59:59.000Z').toISOString()
        payload.subscription_ends_at = null
      } else {
        payload.subscription_ends_at = new Date(subForm.expires_at + 'T23:59:59.000Z').toISOString()
        payload.trial_ends_at = null
      }

      const { error } = await supabase
        .from('institutes')
        .update(payload)
        .eq('id', selectedInstForSubscription.id)

      if (error) throw error

      alert(`Successfully updated subscription for ${selectedInstForSubscription.name}!`)
      setSelectedInstForSubscription(null)
      fetchSuperadminData()
    } catch (err) {
      alert(`Failed to save subscription: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Confirm and approve a pending UPI payment
  const handleConfirmUpiPayment = async (p) => {
    if (!window.confirm(`Confirm payment of ₹${p.total_amount} for ${p.institutes?.name}? This will instantly activate their plan.`)) return

    try {
      const durationDays = p.billing_cycle === 'annual' ? 365 : 30
      const newExpiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

      // 1. Update institute subscription status & plan
      const { error: instErr } = await supabase
        .from('institutes')
        .update({
          subscription_status: 'active',
          plan: p.plan,
          subscription_ends_at: newExpiry
        })
        .eq('id', p.institute_id)

      if (instErr) throw instErr

      // 2. Update payment record to success
      const { error: payErr } = await supabase
        .from('payments')
        .update({ status: 'success' })
        .eq('id', p.id)

      if (payErr) throw payErr

      // 3. Notify owner via WhatsApp
      const notifyPhone = p.institutes?.phone
      if (notifyPhone) {
        const msg = `✅ Payment Approved!\nYour CoachPro ${p.plan?.toUpperCase()} subscription is now active until ${new Date(newExpiry).toLocaleDateString('en-IN')}.\nInvoice No: ${p.invoice_number}\n— CoachPro Team`
        await sendWhatsAppMessage(notifyPhone, msg)
      }

      alert('Payment confirmed & subscription activated!')
      setSelectedPaymentVerify(null)
      fetchSuperadminData()
    } catch (err) {
      alert(`Failed to approve payment: ${err.message}`)
    }
  }

  // Reject a pending UPI payment
  const handleRejectUpiPayment = async (p) => {
    const reason = window.prompt('Please enter the reason for rejecting this payment (this will be sent to the institute owner):', 'UTR number could not be verified in our bank statement.')
    if (reason === null) return // cancelled

    try {
      // 1. Update payment record to failed with reject reason
      const { error: payErr } = await supabase
        .from('payments')
        .update({
          status: 'failed',
          notes: `Rejected by Admin: ${reason}`
        })
        .eq('id', p.id)

      if (payErr) throw payErr

      // 2. Notify owner via WhatsApp
      const notifyPhone = p.institutes?.phone
      if (notifyPhone) {
        const msg = `❌ Payment Rejected\nYour CoachPro subscription payment submission (Invoice: ${p.invoice_number}) was rejected.\nReason: ${reason}\nContact support if you think this is a mistake.`
        await sendWhatsAppMessage(notifyPhone, msg)
      }

      alert('Payment rejected & institute owner notified.')
      setSelectedPaymentVerify(null)
      fetchSuperadminData()
    } catch (err) {
      alert(`Failed to reject payment: ${err.message}`)
    }
  }

  const handleCancelTrial = async (inst) => {
    if (!window.confirm(`Are you sure you want to cancel the free trial for ${inst.name}? This will lock their access immediately.`)) return
    setLoading(true)
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { error } = await supabase
        .from('institutes')
        .update({
          subscription_status: 'expired',
          trial_ends_at: yesterday,
          subscription_ends_at: null
        })
        .eq('id', inst.id)

      if (error) throw error

      alert(`Free trial cancelled for ${inst.name}!`)
      fetchSuperadminData()
    } catch (err) {
      alert(`Failed to cancel trial: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Toggle Ban Status of Coaching Institute
  const handleToggleBan = async (inst) => {
    const isBanned = inst.subscription_status === 'suspended'
    const nextStatus = isBanned ? 'active' : 'suspended'
    const confirmMsg = isBanned 
      ? `Are you sure you want to reactivate ${inst.name}?` 
      : `Are you sure you want to BAN ${inst.name}? All their users will be blocked from logging in.`
    
    if (!window.confirm(confirmMsg)) return

    try {
      const { error } = await supabase
        .from('institutes')
        .update({ subscription_status: nextStatus })
        .eq('id', inst.id)

      if (error) throw error
      alert(`Institute has been successfully ${isBanned ? 'reactivated' : 'banned'}!`)
      fetchSuperadminData()
    } catch (err) {
      alert(`Failed to update status: ${err.message}`)
    }
  }

  // Cascade Delete Coaching Institute
  const handleDeleteInstitute = async (inst) => {
    const confirmMsg = `WARNING: Are you sure you want to PERMANENTLY delete ${inst.name}? \nThis will cascade delete all batch schedules, attendance logs, student accounts, fees ledger, and database records. This cannot be undone!`
    if (!window.confirm(confirmMsg)) return

    try {
      const { error } = await supabase
        .from('institutes')
        .delete()
        .eq('id', inst.id)

      if (error) throw error
      alert('Coaching institute has been successfully deleted!')
      fetchSuperadminData()
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  // Create Coupon
  const handleCreateCouponSubmit = async (e) => {
    e.preventDefault()
    if (!couponForm.code || !couponForm.discount_value) return
    try {
      await supabase.from('coupons').insert({
        code: couponForm.code.toUpperCase().trim(),
        discount_type: couponForm.discount_type,
        discount_value: Number(couponForm.discount_value),
        max_uses: Number(couponForm.max_uses) || 100,
        is_active: true,
      })
      setShowCouponModal(false)
      setCouponForm({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '100' })
      fetchSuperadminData()
    } catch (err) {
      alert(`Coupon creation failed: ${err.message}`)
    }
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  // Revenue analytics
  const successfulPayments = payments.filter(p => p.status === 'success')
  const totalARR = successfulPayments.reduce((s, p) => s + (Number(p.total_amount) || 0), 0)
  const totalMRR = Math.round(totalARR / 12)

  return (
    <div className="space-y-6">
      {/* Superadmin Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 to-[#1E3A8A] text-white p-6 rounded-3xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} className="text-[#F97316]" />
            <h1 className="text-2xl font-extrabold">Superadmin Operations Hub</h1>
          </div>
          <p className="text-xs text-blue-200">Global control center for payments verification, institute management, coupons, and MRR analytics</p>
        </div>
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchSuperadminData} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
          Refresh Systems
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'institutes', label: `Institutes (${institutes.length})`, icon: Building2 },
          { id: 'payments', label: `Payments Verification (${payments.filter(p => p.status === 'pending').length} Pending)`, icon: CreditCard },
          { id: 'coupons', label: `Coupons Manager (${coupons.length})`, icon: Tag },
          { id: 'revenue', label: 'Revenue & Analytics', icon: TrendingUp },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${isActive ? 'bg-[#1E3A8A] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
              <Icon size={16} className={isActive ? 'text-[#F97316]' : 'text-gray-400'} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: INSTITUTES */}
      {activeTab === 'institutes' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                  <th className="p-3.5">Institute</th>
                  <th className="p-3.5">Plan</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">Joined</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {institutes.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-gray-900">{i.name}</td>
                    <td className="p-3.5 font-mono text-xs uppercase font-bold text-[#1E3A8A]">{i.plan || 'starter'}</td>
                    <td className="p-3.5"><StatusBadge status={i.subscription_status || 'trial'} /></td>
                    <td className="p-3.5 text-xs text-gray-600">{i.phone || '—'}</td>
                    <td className="p-3.5 text-xs text-gray-400">{new Date(i.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => handleOpenSubscriptionModal(i)}
                      >
                        🔧 Subscription
                      </Button>
                      {i.subscription_status === 'trial' && (
                        <Button
                          size="xs"
                          variant="danger"
                          onClick={() => handleCancelTrial(i)}
                        >
                          Cancel Trial
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleOfferDiscount(i)}
                        className="bg-white"
                      >
                        % Discount {i.settings?.custom_discount_percentage ? `(${i.settings.custom_discount_percentage}%)` : ''}
                      </Button>
                      <Button
                        size="xs"
                        variant={i.subscription_status === 'suspended' ? 'success' : 'warning'}
                        onClick={() => handleToggleBan(i)}
                      >
                        {i.subscription_status === 'suspended' ? 'Unban' : 'Ban'}
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() => handleDeleteInstitute(i)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: PAYMENTS VERIFICATION */}
      {activeTab === 'payments' && (
        <Card>
          <CardHeader><CardTitle>Payments & Subscription Transactions</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Institute</th>
                  <th className="p-3.5">Plan</th>
                  <th className="p-3.5">Total Amount</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">No payment transactions found.</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3.5 text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="p-3.5 font-bold text-gray-900">{p.institutes?.name || '—'}</td>
                    <td className="p-3.5 font-mono text-xs uppercase font-bold text-[#1E3A8A]">{p.plan}</td>
                    <td className="p-3.5 font-extrabold text-green-600">₹{(p.total_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3.5 uppercase text-[10px] font-bold text-gray-600">{p.method}</td>
                    <td className="p-3.5"><StatusBadge status={p.status} /></td>
                    <td className="p-3.5 text-right">
                      {p.status === 'pending' ? (
                        <Button size="xs" variant="warning" onClick={() => setSelectedPaymentVerify(p)}>Verify UPI</Button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: COUPONS MANAGER */}
      {activeTab === 'coupons' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="accent" icon={Tag} onClick={() => setShowCouponModal(true)}>Create Promo Coupon</Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                    <th className="p-3.5">Code</th>
                    <th className="p-3.5">Discount</th>
                    <th className="p-3.5">Max Uses</th>
                    <th className="p-3.5">Used Count</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coupons.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-extrabold text-[#1E3A8A]">{c.code}</td>
                      <td className="p-3.5 font-bold text-green-600">{c.discount_value}{c.discount_type === 'percentage' ? '%' : ' ₹'} OFF</td>
                      <td className="p-3.5 text-gray-600">{c.max_uses}</td>
                      <td className="p-3.5 font-bold text-gray-900">{c.used_count || 0}</td>
                      <td className="p-3.5"><StatusBadge status={c.is_active ? 'active' : 'inactive'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: REVENUE OVERVIEW */}
      {activeTab === 'revenue' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
            <p className="text-xs uppercase font-bold text-green-700">Estimated MRR (Monthly Recurring Revenue)</p>
            <p className="text-3xl font-extrabold text-green-800 mt-1">₹{totalMRR.toLocaleString('en-IN')}</p>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
            <p className="text-xs uppercase font-bold text-[#1E3A8A]">Total ARR (Annual Gross Collections)</p>
            <p className="text-3xl font-extrabold text-[#1E3A8A] mt-1">₹{totalARR.toLocaleString('en-IN')}</p>
          </Card>
        </div>
      )}

      {/* Verify Payment Modal */}
      {selectedPaymentVerify && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPaymentVerify(null)}
          title={`Verify UPI Submission: ${selectedPaymentVerify.institutes?.name}`}
          footer={
            <div className="flex gap-3 w-full justify-end">
              <Button variant="danger" onClick={() => handleRejectUpiPayment(selectedPaymentVerify)}>Reject Payment</Button>
              <Button variant="success" icon={Check} onClick={() => handleConfirmUpiPayment(selectedPaymentVerify)}>Activate & Confirm</Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Amount mismatch warning */}
            {selectedPaymentVerify.paid_amount_claimed !== undefined && 
             selectedPaymentVerify.paid_amount_claimed !== null && 
             Number(selectedPaymentVerify.paid_amount_claimed) !== Number(selectedPaymentVerify.total_amount) && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-red-800">
                <AlertOctagon size={20} className="text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-bold mb-0.5">⚠️ Amount Mismatch Warning!</p>
                  <p>The institute claimed they paid <strong>₹{selectedPaymentVerify.paid_amount_claimed.toLocaleString('en-IN')}</strong>, but the system expected <strong>₹{selectedPaymentVerify.total_amount.toLocaleString('en-IN')}</strong>.</p>
                  <p className="mt-1 font-medium text-red-700">Please double check your bank statement for UTR <strong>{selectedPaymentVerify.utr_number}</strong> before approving.</p>
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-400 block uppercase font-bold text-[9px]">Institute</span>
                <span className="font-bold text-gray-900">{selectedPaymentVerify.institutes?.name}</span>
              </div>
              <div>
                <span className="text-gray-400 block uppercase font-bold text-[9px]">Plan</span>
                <span className="font-mono font-bold text-[#1E3A8A] uppercase">{selectedPaymentVerify.plan} ({selectedPaymentVerify.billing_cycle})</span>
              </div>
              <div>
                <span className="text-gray-400 block uppercase font-bold text-[9px]">Expected Amount</span>
                <span className="font-extrabold text-blue-900">₹{(selectedPaymentVerify.total_amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-gray-400 block uppercase font-bold text-[9px]">Amount Claimed Paid</span>
                <span className={`font-extrabold ${Number(selectedPaymentVerify.paid_amount_claimed) === Number(selectedPaymentVerify.total_amount) ? 'text-green-600' : 'text-red-600 font-black'}`}>
                  ₹{(selectedPaymentVerify.paid_amount_claimed || selectedPaymentVerify.total_amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="col-span-2 border-t border-gray-200 pt-2">
                <span className="text-gray-400 block uppercase font-bold text-[9px]">UTR / UPI Ref Number</span>
                <span className="font-mono font-bold text-gray-900 select-all text-sm">{selectedPaymentVerify.utr_number}</span>
              </div>
            </div>

            {selectedPaymentVerify.screenshot_url && (
              <div className="text-center">
                <p className="font-bold text-gray-700 mb-2">Submitted Screenshot:</p>
                <img src={selectedPaymentVerify.screenshot_url} alt="Screenshot" className="max-h-60 mx-auto rounded-xl border" />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Manage Subscription Modal */}
      {selectedInstForSubscription && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInstForSubscription(null)}
          title={`Activate / Manage Subscription: ${selectedInstForSubscription.name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedInstForSubscription(null)}>Cancel</Button>
              <Button onClick={handleSaveSubscription} icon={Check}>Save Changes</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="Selected Plan Tier *"
              value={subForm.plan}
              onChange={(e) => setSubForm({ ...subForm, plan: e.target.value })}
              options={[
                { value: 'starter', label: 'Starter Plan (150 students)' },
                { value: 'growth', label: 'Growth Plan (400 students)' },
                { value: 'pro', label: 'Pro Plan (1000 students)' },
                { value: 'enterprise', label: 'Enterprise Plan (unlimited)' },
              ]}
            />
            <Select
              label="Subscription Status *"
              value={subForm.status}
              onChange={(e) => setSubForm({ ...subForm, status: e.target.value })}
              options={[
                { value: 'trial', label: 'Free Trial' },
                { value: 'active', label: 'Active Plan' },
                { value: 'expired', label: 'Expired' },
                { value: 'suspended', label: 'Suspended / Banned' },
              ]}
            />
            <div className="space-y-1.5">
              <Input
                label="Expiration Date *"
                type="date"
                value={subForm.expires_at}
                onChange={(e) => setSubForm({ ...subForm, expires_at: e.target.value })}
                required
              />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setExpiryDays(30)} className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold px-2.5 py-1 rounded-lg border">
                  +1 Month (30d)
                </button>
                <button type="button" onClick={() => setExpiryDays(365)} className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold px-2.5 py-1 rounded-lg border">
                  +1 Year (365d)
                </button>
                <button type="button" onClick={() => setExpiryDays(3650)} className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold px-2.5 py-1 rounded-lg border">
                  +10 Years (Lifetime)
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Coupon Modal */}
      {showCouponModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCouponModal(false)}
          title="Create New Promo Coupon"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowCouponModal(false)}>Cancel</Button>
              <Button onClick={handleCreateCouponSubmit}>Create Coupon</Button>
            </>
          }
        >
          <form onSubmit={handleCreateCouponSubmit} className="space-y-4">
            <Input label="Coupon Code *" placeholder="e.g. DIWALI30" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} required />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Type" value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} options={[{ value: 'percentage', label: 'Percentage (%)' }, { value: 'fixed', label: 'Fixed (₹)' }]} />
              <Input label="Discount Value *" type="number" placeholder="20" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} required />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
