import { useState, useEffect } from 'react'
import {
  CreditCard, Calendar, Clock, Sparkles, CheckCircle2, AlertCircle, Plus, Trash2, ArrowLeft, ArrowRight, Check
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

export default function FeeStructureWizard({ onClose, onSaved }) {
  const { profile } = useAuth()
  const instituteId = profile?.institute_id

  const [step, setStep] = useState(1) // 1 | 2 | 3
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form State
  const [form, setForm] = useState({
    name: '',
    course_id: '',
    total_amount: '',
    frequency: 'monthly', // full | monthly | quarterly | half_yearly | yearly | custom
    months_count: '6',
  })

  // Custom schedule rows for custom frequency
  const [customRows, setCustomRows] = useState([
    { label: 'Admission Fee', amount: '5000', due_date: new Date().toISOString().split('T')[0] },
  ])

  // Calculated schedule preview for Step 3
  const [schedulePreview, setSchedulePreview] = useState([])

  useEffect(() => {
    if (instituteId) fetchCourses()
  }, [instituteId])

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('id, name, total_fee').eq('institute_id', instituteId)
    setCourses(data || [])
  }

  const handleCourseChange = (courseId) => {
    const selected = courses.find(c => c.id === courseId)
    setForm({
      ...form,
      course_id: courseId,
      total_amount: selected?.total_fee ? String(selected.total_fee) : form.total_amount
    })
  }

  // Calculate schedule based on frequency
  const generateSchedule = () => {
    const total = Number(form.total_amount) || 0
    const startDate = new Date()
    const result = []

    if (form.frequency === 'full' || form.frequency === 'yearly') {
      result.push({
        installment_number: 1,
        label: form.frequency === 'full' ? 'Full Payment' : 'Yearly Installment',
        amount: total,
        due_date: startDate.toISOString().split('T')[0]
      })
    } else if (form.frequency === 'monthly') {
      const count = Math.max(1, Number(form.months_count) || 1)
      const perMonth = Math.round(total / count)
      for (let i = 1; i <= count; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + (i - 1), 1)
        const amt = i === count ? total - perMonth * (count - 1) : perMonth
        result.push({
          installment_number: i,
          label: `Month ${i}`,
          amount: amt,
          due_date: d.toISOString().split('T')[0]
        })
      }
    } else if (form.frequency === 'quarterly') {
      const count = 4
      const perQuarter = Math.round(total / count)
      for (let i = 1; i <= count; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + (i - 1) * 3, 1)
        const amt = i === count ? total - perQuarter * (count - 1) : perQuarter
        result.push({
          installment_number: i,
          label: `Quarter ${i}`,
          amount: amt,
          due_date: d.toISOString().split('T')[0]
        })
      }
    } else if (form.frequency === 'half_yearly') {
      const count = 2
      const perHalf = Math.round(total / count)
      for (let i = 1; i <= count; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + (i - 1) * 6, 1)
        const amt = i === count ? total - perHalf * (count - 1) : perHalf
        result.push({
          installment_number: i,
          label: `Half Yearly ${i}`,
          amount: amt,
          due_date: d.toISOString().split('T')[0]
        })
      }
    } else if (form.frequency === 'custom') {
      customRows.forEach((r, idx) => {
        result.push({
          installment_number: idx + 1,
          label: r.label || `Installment ${idx + 1}`,
          amount: Number(r.amount) || 0,
          due_date: r.due_date || startDate.toISOString().split('T')[0]
        })
      })
    }

    return result
  }

  const handleNextStep1 = () => {
    if (!form.name.trim()) { setError('Structure name is required.'); return }
    if (!form.course_id) { setError('Please select a course.'); return }
    if (!form.total_amount || Number(form.total_amount) <= 0) { setError('Please enter a valid total fee.'); return }
    setError('')
    setStep(2)
  }

  const handleNextStep2 = () => {
    setError('')
    if (form.frequency === 'custom') {
      const customSum = customRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
      const target = Number(form.total_amount)
      if (customSum !== target) {
        setError(`Custom installments sum (₹${customSum.toLocaleString('en-IN')}) does not match Total Fee (₹${target.toLocaleString('en-IN')}).`)
        return
      }
    }

    const generated = generateSchedule()
    setSchedulePreview(generated)
    setStep(3)
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = {
        institute_id: instituteId,
        course_id: form.course_id,
        name: form.name.trim(),
        total_amount: Number(form.total_amount),
        frequency: form.frequency,
        installments_count: schedulePreview.length,
      }

      const { error: err } = await supabase.from('fee_structures').insert(payload)
      if (err) throw err

      onSaved?.()
    } catch (err) {
      setError(err.message || 'Failed to save fee structure.')
    } finally {
      setLoading(false)
    }
  }

  // Custom row manipulators
  const addCustomRow = () => {
    setCustomRows([...customRows, { label: `Installment ${customRows.length + 1}`, amount: '', due_date: new Date().toISOString().split('T')[0] }])
  }
  const removeCustomRow = (idx) => {
    setCustomRows(customRows.filter((_, i) => i !== idx))
  }
  const updateCustomRow = (idx, field, val) => {
    const updated = [...customRows]
    updated[idx][field] = val
    setCustomRows(updated)
  }

  const customTotal = customRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const targetTotal = Number(form.total_amount) || 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Wizard Header Bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onClose}>
          Back to Fee Structures
        </Button>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-[#1E3A8A] text-white' : 'bg-gray-100 text-gray-400'}`}>1. Basic Info</span>
          <span className="text-gray-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-[#1E3A8A] text-white' : 'bg-gray-100 text-gray-400'}`}>2. Frequency</span>
          <span className="text-gray-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-[#1E3A8A] text-white' : 'bg-gray-100 text-gray-400'}`}>3. Preview & Save</span>
        </div>
      </div>

      {/* STEP 1: BASIC INFO */}
      {step === 1 && (
        <Card className="p-6 space-y-5 border border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Step 1: Basic Structure Details</h2>
            <p className="text-xs text-gray-500">Define the structure title and link it to a course program</p>
          </div>

          <div className="space-y-4">
            <Input
              label="Structure Name *"
              placeholder="e.g. Standard 6-Month Installment Plan"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Select
              label="Link to Course *"
              value={form.course_id}
              onChange={(e) => handleCourseChange(e.target.value)}
              options={[
                { value: '', label: 'Select Course' },
                ...courses.map(c => ({ value: c.id, label: `${c.name} (₹${(c.total_fee || 0).toLocaleString('en-IN')})` }))
              ]}
              required
            />
            <Input
              label="Total Structure Fee (₹) *"
              type="number"
              placeholder="e.g. 30000"
              value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
              required
            />
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-medium">{error}</div>}

          <div className="flex justify-end pt-3">
            <Button variant="accent" iconRight={<ArrowRight size={16} />} onClick={handleNextStep1}>
              Next: Choose Frequency →
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: CHOOSE FREQUENCY */}
      {step === 2 && (
        <Card className="p-6 space-y-6 border border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Step 2: Choose Payment Frequency</h2>
            <p className="text-xs text-gray-500">Select how students will pay their total fee of <strong>₹{targetTotal.toLocaleString('en-IN')}</strong></p>
          </div>

          {/* 6 Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { id: 'full', title: '💳 Full Payment', desc: 'Single one-time payment', badge: '1 Installment' },
              { id: 'monthly', title: '📅 Monthly', desc: 'Equal monthly payments', badge: 'Flexible Months' },
              { id: 'quarterly', title: '📆 Quarterly', desc: 'Payment every 3 months', badge: '4 Installments' },
              { id: 'half_yearly', title: '🗓️ Half Yearly', desc: 'Two payments per year', badge: '2 Installments' },
              { id: 'yearly', title: '📊 Yearly', desc: 'One payment per year', badge: '1 Installment' },
              { id: 'custom', title: '✏️ Custom Schedule', desc: 'Set your own dates & amounts', badge: 'Custom Rows' },
            ].map(item => {
              const selected = form.frequency === item.id
              return (
                <div
                  key={item.id}
                  onClick={() => setForm({ ...form, frequency: item.id })}
                  className={`
                    p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-2
                    ${selected ? 'bg-blue-50/70 border-[#1E3A8A] ring-2 ring-[#1E3A8A]/20 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300'}
                  `}
                >
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-gray-100 text-gray-600 self-start">
                    {item.badge}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Extra Configuration based on selected frequency */}
          {form.frequency === 'monthly' && (
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
              <Input
                label="Number of Monthly Installments"
                type="number"
                value={form.months_count}
                onChange={(e) => setForm({ ...form, months_count: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Each monthly installment will be approx <strong>₹{Math.round(targetTotal / (Number(form.months_count) || 1)).toLocaleString('en-IN')}</strong>.
              </p>
            </div>
          )}

          {form.frequency === 'custom' && (
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-900 text-sm">Custom Schedule Builder</h4>
                <Button size="xs" variant="outline" icon={Plus} onClick={addCustomRow} className="bg-white">Add Row</Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {customRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200">
                    <input
                      type="text"
                      placeholder="Label (e.g. Admission)"
                      value={row.label}
                      onChange={(e) => updateCustomRow(idx, 'label', e.target.value)}
                      className="w-1/3 text-xs p-1.5 border rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="Amount ₹"
                      value={row.amount}
                      onChange={(e) => updateCustomRow(idx, 'amount', e.target.value)}
                      className="w-1/3 text-xs p-1.5 border rounded-lg font-bold"
                    />
                    <input
                      type="date"
                      value={row.due_date}
                      onChange={(e) => updateCustomRow(idx, 'due_date', e.target.value)}
                      className="w-1/3 text-xs p-1.5 border rounded-lg"
                    />
                    {customRows.length > 1 && (
                      <button onClick={() => removeCustomRow(idx)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Running total validation */}
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${customTotal === targetTotal ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <span>Running Total: ₹{customTotal.toLocaleString('en-IN')} / Target: ₹{targetTotal.toLocaleString('en-IN')}</span>
                <span>{customTotal === targetTotal ? '✅ Sum Matches!' : '⚠️ Sum does not match target fee'}</span>
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-medium">{error}</div>}

          <div className="flex justify-between pt-3">
            <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
            <Button variant="accent" iconRight={<ArrowRight size={16} />} onClick={handleNextStep2}>
              Next: Preview Schedule →
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: PREVIEW & SAVE */}
      {step === 3 && (
        <Card className="p-6 space-y-6 border border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Step 3: Preview & Confirm Schedule</h2>
            <p className="text-xs text-gray-500">Review the complete installment schedule before saving</p>
          </div>

          <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-200">
                  <th className="p-3">#</th>
                  <th className="p-3">Label</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Estimated Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedulePreview.map((s) => (
                  <tr key={s.installment_number} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-700">#{s.installment_number}</td>
                    <td className="p-3 font-semibold text-gray-900">{s.label}</td>
                    <td className="p-3 font-extrabold text-[#1E3A8A]">₹{s.amount.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-gray-600">{new Date(s.due_date).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-t border-blue-100 flex items-center justify-between text-sm font-bold text-gray-900">
              <span>Total Configured Schedule:</span>
              <span className="text-[#1E3A8A] text-base">₹{schedulePreview.reduce((sum, i) => sum + i.amount, 0).toLocaleString('en-IN')} ✅</span>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-medium">{error}</div>}

          <div className="flex justify-between pt-3">
            <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
            <Button variant="accent" loading={loading} icon={Check} onClick={handleSave} className="shadow-lg">
              Confirm & Save Fee Structure
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
