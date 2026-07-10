import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Check, X, Sparkles, Shield, CreditCard, Award, HelpCircle, ChevronDown, ChevronUp,
  Sliders, ArrowRight, Phone, MessageSquare, Lock, Globe, Zap, HeartHandshake
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

export default function Pricing() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [isAnnual, setIsAnnual] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [studentCount, setStudentCount] = useState(200)
  const [activeFaq, setActiveFaq] = useState(null)

  // Registration modal state for unauthenticated users
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedPlanForAuth, setSelectedPlanForAuth] = useState(null)

  const handlePlanCta = (planKey) => {
    if (planKey === 'enterprise') {
      const msg = `Hi, I'm interested in CoachPro Enterprise plan for ${profile?.institutes?.name || 'my institute'}`
      window.open(`https://wa.me/${import.meta.env.VITE_SUPPORT_WHATSAPP || '919876543210'}?text=${encodeURIComponent(msg)}`, '_blank')
      return
    }

    if (!user) {
      setSelectedPlanForAuth(planKey)
      setShowRegisterModal(true)
    } else {
      navigate('/billing', { state: { plan: planKey, billing: isAnnual ? 'annual' : 'monthly' } })
    }
  }

  // Cost calculator logic
  const getRecommendedPlan = (count) => {
    if (count <= 150) return { name: 'Starter Plan', cost: isAnnual ? 599 : 799, perStudent: ((isAnnual ? 599 : 799) / count).toFixed(1), planKey: 'starter' }
    if (count <= 400) return { name: 'Growth Plan', cost: isAnnual ? 1124 : 1499, perStudent: ((isAnnual ? 1124 : 1499) / count).toFixed(1), planKey: 'growth' }
    if (count <= 1000) return { name: 'Pro Plan', cost: isAnnual ? 1874 : 2499, perStudent: ((isAnnual ? 1874 : 2499) / count).toFixed(1), planKey: 'pro' }
    return { name: 'Enterprise Plan', cost: isAnnual ? 2999 : 3999, perStudent: ((isAnnual ? 2999 : 3999) / count).toFixed(1), planKey: 'enterprise' }
  }

  const calc = getRecommendedPlan(studentCount)

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 space-y-16">
      {/* SECTION 1: PAGE HEADER */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <Badge variant="primary" className="px-3 py-1 text-xs uppercase tracking-wider">Simple Transparent Billing</Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
          Simple Pricing for Every Institute
        </h1>
        <p className="text-lg text-gray-600">
          No setup fee. No transaction cut. Cancel anytime.
        </p>

        {/* Monthly / Annual Toggle Switch */}
        <div className="pt-4 flex items-center justify-center gap-4">
          <span className={`text-sm font-bold ${!isAnnual ? 'text-[#1E3A8A]' : 'text-gray-500'}`}>Monthly Billing</span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-16 h-8 rounded-full bg-[#1E3A8A] p-1 transition-colors relative focus:outline-none shadow-inner"
          >
            <div className={`w-6 h-6 rounded-full bg-white transition-transform shadow-md ${isAnnual ? 'translate-x-8' : 'translate-x-0'}`} />
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold ${isAnnual ? 'text-[#1E3A8A]' : 'text-gray-500'}`}>Annual Billing</span>
            <span className="bg-green-100 text-green-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase border border-green-200 shadow-2xs">
              Save 25%
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: 4 PLAN CARDS */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* PLAN 1: STARTER */}
        <Card className="p-6 flex flex-col justify-between border-gray-200 bg-white shadow-sm hover:shadow-md transition-all relative">
          <div className="space-y-4">
            <h3 className="font-extrabold text-xl text-gray-900">STARTER</h3>
            <p className="text-xs text-gray-500 font-medium">Perfect for small tuitions</p>
            <div className="pt-2">
              <span className="text-3xl font-extrabold text-gray-900">₹{isAnnual ? '599' : '799'}</span>
              <span className="text-xs text-gray-500">/month</span>
              {isAnnual && <p className="text-[10px] font-bold text-green-600 mt-0.5">billed ₹7,190/year</p>}
            </div>

            <div className="space-y-1.5 pt-3 border-t border-gray-100 text-xs text-gray-700 font-semibold">
              <p>👥 Up to 150 Students</p>
              <p>📚 Up to 8 Batches</p>
              <p>👨‍🏫 2 Staff Accounts</p>
              <p>🏢 1 Branch</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-gray-100 text-xs">
              {[
                { label: 'Student enrollment & profiles', inc: true },
                { label: 'Student ID auto-generation', inc: true },
                { label: 'QR code per student', inc: true },
                { label: 'Basic fee collection & PDF receipts', inc: true },
                { label: 'Daily attendance & timetable', inc: true },
                { label: 'CSV export & Email support', inc: true },
                { label: 'WhatsApp automated alerts', inc: false },
                { label: 'Custom fee installments', inc: false },
                { label: 'UPI QR payment links', inc: false },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  {f.inc ? <Check size={14} className="text-green-600 flex-shrink-0" /> : <X size={14} className="text-gray-300 flex-shrink-0" />}
                  <span className={f.inc ? 'text-gray-800' : 'text-gray-400 line-through'}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 space-y-2">
            <Button fullWidth variant="outline" onClick={() => handlePlanCta('starter')} className="bg-white">
              Start Free Trial
            </Button>
            <p className="text-[10px] text-center text-gray-400">30 days free · No card required</p>
          </div>
        </Card>

        {/* PLAN 2: GROWTH ⭐ MOST POPULAR */}
        <Card className="p-6 flex flex-col justify-between border-2 border-[#1E3A8A] bg-gradient-to-b from-blue-50/60 to-white shadow-xl relative scale-102">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#F97316] text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow-md uppercase tracking-wider">
            ⭐ MOST POPULAR
          </div>
          <div className="space-y-4 pt-1">
            <h3 className="font-extrabold text-xl text-[#1E3A8A]">GROWTH</h3>
            <p className="text-xs text-gray-600 font-medium">Best for growing coaching institutes</p>
            <div className="pt-2">
              <span className="text-4xl font-extrabold text-gray-900">₹{isAnnual ? '1,124' : '1,499'}</span>
              <span className="text-xs text-gray-500">/month</span>
              {isAnnual && <p className="text-[10px] font-bold text-green-600 mt-0.5">billed ₹13,490/year</p>}
            </div>

            <div className="space-y-1.5 pt-3 border-t border-blue-100 text-xs text-gray-800 font-extrabold">
              <p>👥 Up to 400 Students</p>
              <p>📚 Up to 20 Batches</p>
              <p>👨‍🏫 6 Staff Accounts</p>
              <p>🏢 2 Branches</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-blue-100 text-xs">
              {[
                { label: 'Everything in Starter, plus:', bold: true },
                { label: 'WhatsApp fee due reminders', inc: true },
                { label: 'WhatsApp payment confirmation', inc: true },
                { label: 'WhatsApp absent alerts to parents', inc: true },
                { label: 'Class cancellation & Exam alerts', inc: true },
                { label: 'All custom fee structures', inc: true },
                { label: 'UPI QR payment links', inc: true },
                { label: 'Notification logs & Institute calendar', inc: true },
                { label: 'Priority chat support (24hr response)', inc: true },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  {f.bold ? <Sparkles size={14} className="text-[#F97316]" /> : <Check size={14} className="text-green-600 flex-shrink-0" />}
                  <span className={f.bold ? 'font-bold text-[#1E3A8A]' : 'text-gray-800'}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 space-y-2">
            <Button fullWidth variant="accent" onClick={() => handlePlanCta('growth')} className="shadow-lg">
              Start Free Trial
            </Button>
            <p className="text-[10px] text-center text-gray-500 font-bold">30 days free · No card required</p>
          </div>
        </Card>

        {/* PLAN 3: PRO */}
        <Card className="p-6 flex flex-col justify-between border-gray-200 bg-white shadow-sm hover:shadow-md transition-all relative">
          <div className="space-y-4">
            <h3 className="font-extrabold text-xl text-gray-900">PRO</h3>
            <p className="text-xs text-gray-500 font-medium">For established multi-batch institutes</p>
            <div className="pt-2">
              <span className="text-3xl font-extrabold text-gray-900">₹{isAnnual ? '1,874' : '2,499'}</span>
              <span className="text-xs text-gray-500">/month</span>
              {isAnnual && <p className="text-[10px] font-bold text-green-600 mt-0.5">billed ₹22,490/year</p>}
            </div>

            <div className="space-y-1.5 pt-3 border-t border-gray-100 text-xs text-gray-700 font-semibold">
              <p>👥 Up to 1,000 Students</p>
              <p>📚 Unlimited Batches</p>
              <p>👨‍🏫 15 Staff Accounts</p>
              <p>🏢 3 Branches</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-gray-100 text-xs">
              {[
                { label: 'Everything in Growth, plus:', bold: true },
                { label: 'Custom branding (Logo & colors)', inc: true },
                { label: 'Student & parent login portal', inc: true },
                { label: 'Bulk WhatsApp messaging', inc: true },
                { label: 'Institute calendar PDF export', inc: true },
                { label: 'Student ID card PDF batch download', inc: true },
                { label: 'Priority phone support & onboarding', inc: true },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  {f.bold ? <Sparkles size={14} className="text-[#1E3A8A]" /> : <Check size={14} className="text-green-600 flex-shrink-0" />}
                  <span className={f.bold ? 'font-bold text-[#1E3A8A]' : 'text-gray-800'}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 space-y-2">
            <Button fullWidth variant="outline" onClick={() => handlePlanCta('pro')} className="bg-white">
              Start Free Trial
            </Button>
            <p className="text-[10px] text-center text-gray-400">30 days free · No card required</p>
          </div>
        </Card>

        {/* PLAN 4: ENTERPRISE */}
        <Card className="p-6 flex flex-col justify-between border-gray-200 bg-white shadow-sm hover:shadow-md transition-all relative">
          <div className="space-y-4">
            <h3 className="font-extrabold text-xl text-gray-900">ENTERPRISE</h3>
            <p className="text-xs text-gray-500 font-medium">For large institutes & franchise chains</p>
            <div className="pt-2">
              <span className="text-3xl font-extrabold text-gray-900">₹{isAnnual ? '2,999' : '3,999'}</span>
              <span className="text-xs text-gray-500">/month</span>
              {isAnnual && <p className="text-[10px] font-bold text-green-600 mt-0.5">billed ₹35,990/year</p>}
            </div>

            <div className="space-y-1.5 pt-3 border-t border-gray-100 text-xs text-gray-700 font-semibold">
              <p>👥 Unlimited Students</p>
              <p>📚 Unlimited Batches</p>
              <p>👨‍🏫 Unlimited Staff</p>
              <p>🏢 Unlimited Branches</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-gray-100 text-xs">
              {[
                { label: 'Everything in Pro, plus:', bold: true },
                { label: 'Cross-branch fee & student reports', inc: true },
                { label: 'API access & custom integrations', inc: true },
                { label: 'Dedicated account manager', inc: true },
                { label: 'WhatsApp setup & Excel data migration', inc: true },
                { label: 'SLA guarantee: 99.9% uptime', inc: true },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  {f.bold ? <Sparkles size={14} className="text-[#1E3A8A]" /> : <Check size={14} className="text-green-600 flex-shrink-0" />}
                  <span className={f.bold ? 'font-bold text-[#1E3A8A]' : 'text-gray-800'}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 space-y-2">
            <Button fullWidth variant="primary" icon={MessageSquare} onClick={() => handlePlanCta('enterprise')}>
              Contact Us
            </Button>
            <p className="text-[10px] text-center text-gray-400">Direct WhatsApp Onboarding</p>
          </div>
        </Card>
      </div>

      {/* SECTION 4: PER STUDENT COST CALCULATOR */}
      <div className="max-w-4xl mx-auto">
        <Card className="p-8 bg-gradient-to-br from-white to-blue-50/50 border border-blue-100 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold text-gray-900 flex items-center justify-center gap-2">
              <Sliders size={24} className="text-[#F97316]" /> How much does it cost per student?
            </h2>
            <p className="text-xs text-gray-500">Drag the slider below to calculate your exact monthly return on investment</p>
          </div>

          <div className="space-y-4 max-w-xl mx-auto">
            <div className="flex justify-between font-bold text-sm text-gray-800">
              <span>Student Capacity:</span>
              <span className="text-xl font-extrabold text-[#1E3A8A]">{studentCount} Students</span>
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={studentCount}
              onChange={(e) => setStudentCount(Number(e.target.value))}
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>10 Students</span>
              <span>500 Students</span>
              <span>1000+ Students</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-blue-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="space-y-1">
              <Badge variant="primary" className="text-xs uppercase">{calc.name}</Badge>
              <p className="text-3xl font-extrabold text-gray-900">₹{calc.cost} <span className="text-xs font-normal text-gray-500">/month</span></p>
              <p className="text-xs text-green-600 font-bold">Per Student: ₹{calc.perStudent} / month</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl text-xs text-orange-950 font-bold max-w-xs">
              ☕ That's less than one chai (₹7.4) per student per month!
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION 3: EXPANDABLE COMPARISON TABLE */}
      <div className="max-w-5xl mx-auto text-center">
        <Button variant="ghost" onClick={() => setShowComparison(!showComparison)} icon={showComparison ? ChevronUp : ChevronDown}>
          {showComparison ? 'Hide full feature comparison' : 'See full feature comparison'}
        </Button>

        {showComparison && (
          <Card className="mt-6 p-6 text-left overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className="p-3 text-gray-900 font-extrabold">Features</th>
                  <th className="p-3 text-[#1E3A8A] font-extrabold text-center">Starter</th>
                  <th className="p-3 text-[#F97316] font-extrabold text-center">Growth</th>
                  <th className="p-3 text-[#1E3A8A] font-extrabold text-center">Pro</th>
                  <th className="p-3 text-purple-700 font-extrabold text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-gray-100 font-bold text-gray-800"><td colSpan={5} className="p-2.5">Students & Batches</td></tr>
                <tr><td className="p-3">Student Limit</td><td className="p-3 text-center">150</td><td className="p-3 text-center">400</td><td className="p-3 text-center">1,000</td><td className="p-3 text-center font-bold">Unlimited</td></tr>
                <tr><td className="p-3">Batch Limit</td><td className="p-3 text-center">8</td><td className="p-3 text-center">20</td><td className="p-3 text-center font-bold">Unlimited</td><td className="p-3 text-center font-bold">Unlimited</td></tr>

                <tr className="bg-gray-100 font-bold text-gray-800"><td colSpan={5} className="p-2.5">Fee & Payment Management</td></tr>
                <tr><td className="p-3">UPI QR Payment Links</td><td className="p-3 text-center text-red-500">❌</td><td className="p-3 text-center text-green-600">✅</td><td className="p-3 text-center text-green-600">✅</td><td className="p-3 text-center text-green-600">✅</td></tr>
                <tr><td className="p-3">Custom Installments</td><td className="p-3 text-center text-red-500">❌</td><td className="p-3 text-center text-green-600">✅</td><td className="p-3 text-center text-green-600">✅</td><td className="p-3 text-center text-green-600">✅</td></tr>

                <tr className="bg-gray-100 font-bold text-gray-800"><td colSpan={5} className="p-2.5">WhatsApp Automated Alerts</td></tr>
                <tr><td className="p-3">Automated WhatsApp Alerts</td><td className="p-3 text-center text-red-500">❌</td><td className="p-3 text-center text-green-600">✅</td><td className="p-3 text-center text-green-600">✅</td><td className="p-3 text-center text-green-600">✅</td></tr>
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* SECTION 5: FAQ SECTION */}
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-extrabold text-gray-900 text-center">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {[
            { q: 'Is there a setup fee?', a: 'No. Zero setup fee. You can start in 5 minutes.' },
            { q: 'Can I cancel anytime?', a: 'Yes. Monthly plans cancel anytime. Annual plans are non-refundable but never auto-renew without your confirmation.' },
            { q: 'What happens to my data if I cancel?', a: 'Your data is safe for 30 days after cancellation. You can export everything before leaving.' },
            { q: 'Do you take a cut of my fee collections?', a: 'Never. We charge a flat monthly fee only. What you collect is 100% yours.' },
            { q: 'Is WhatsApp included or extra?', a: 'WhatsApp alerts are fully included in Growth, Pro, and Enterprise plans. No credit packs needed.' },
          ].map((faq, idx) => (
            <Card key={idx} className="p-4 cursor-pointer" onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}>
              <div className="flex items-center justify-between font-bold text-sm text-gray-900">
                <span>{faq.q}</span>
                {activeFaq === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {activeFaq === idx && <p className="text-xs text-gray-600 pt-2.5 border-t border-gray-100 mt-2.5">{faq.a}</p>}
            </Card>
          ))}
        </div>
      </div>

      {/* SECTION 6: TRUST BADGES ROW */}
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-3xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-around gap-6 text-xs font-bold text-gray-700">
        <span className="flex items-center gap-2"><Lock size={16} className="text-green-600" /> 🔒 SSL Secured</span>
        <span className="flex items-center gap-2"><QrCode size={16} className="text-[#1E3A8A]" /> 📱 UPI QR Payments</span>
        <span className="flex items-center gap-2"><Globe size={16} className="text-[#F97316]" /> 🇮🇳 Made in India</span>
        <span className="flex items-center gap-2"><Award size={16} className="text-yellow-600" /> ⭐ 30-Day Free Trial</span>
        <span className="flex items-center gap-2"><MessageSquare size={16} className="text-green-600" /> 📞 WhatsApp Support</span>
      </div>

      {showRegisterModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowRegisterModal(false)}
          title="Create CoachPro Account"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowRegisterModal(false)}>Cancel</Button>
              <Button variant="accent" onClick={() => navigate('/register')}>Continue to Register</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-blue-50 text-[#1E3A8A] p-4 rounded-xl border border-blue-200">
              <p className="text-sm font-bold">Great choice! You're choosing the {selectedPlanForAuth?.toUpperCase() || 'STARTER'} plan.</p>
              <p className="text-xs mt-1">Register now to activate your 30-day free trial. No credit card required.</p>
            </div>
            <p className="text-xs text-gray-600">Please click the button below to go to our registration page.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
