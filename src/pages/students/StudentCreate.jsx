import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserPlus, Upload, CheckCircle2, ArrowRight, ArrowLeft,
  GraduationCap, BookOpen, Layers, CreditCard, Sparkles, User, Shield
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'

function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  const array = new Uint32Array(16)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array)
    for (let i = 0; i < 16; i++) {
      password += chars[array[i] % chars.length]
    }
  } else {
    for (let i = 0; i < 16; i++) {
      password += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  return password
}

export default function StudentCreate() {
  const { profile, institute } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const instituteId = profile?.institute_id

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [planLimit, setPlanLimit] = useState(150)

  // Options states
  const [courses, setCourses] = useState([])
  const [batches, setBatches] = useState([])
  const [feeStructures, setFeeStructures] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submittedStudent, setSubmittedStudent] = useState(null)
  
  // Credentials States
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [createdStudentEmail, setCreatedStudentEmail] = useState('')
  const [tempStudent, setTempStudent] = useState(null)

  // Photo state
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')

  // Form State
  const [form, setForm] = useState({
    name: '',
    phone: '',
    parent_name: '',
    parent_phone: '',
    email: '',
    dob: '',
    address: '',
    course_id: '',
    batch_id: '',
    enrolled_at: new Date().toISOString().split('T')[0],
    fee_structure_id: '',
    discount_amount: '',
    discount_reason: '',
    is_scholarship: false,
    scholarship_val: '',
    scholarship_type: 'percent', // percent | fixed
  })

  useEffect(() => {
    if (instituteId) {
      fetchDropdownData()
    }
  }, [instituteId])

  const fetchDropdownData = async () => {
    try {
      const [cRes, bRes, fRes] = await Promise.all([
        supabase.from('courses').select('id, name, total_fee').eq('institute_id', instituteId).order('name'),
        supabase.from('batches').select('id, name, course_id').eq('institute_id', instituteId).order('name'),
        supabase.from('fee_structures').select('*').eq('institute_id', instituteId)
      ])
      setCourses(cRes.data || [])
      setBatches(bRes.data || [])
      setFeeStructures(fRes.data || [])
    } catch (err) {
      console.error('Fetch dropdown data error:', err)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const setCheck = (k) => (e) => setForm({ ...form, [k]: e.target.checked })

  // Photo upload preview
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const generateStudentCode = () => {
    const year = new Date().getFullYear()
    const rand = Math.floor(100 + Math.random() * 900)
    return `STU-${year}-${rand}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.parent_name.trim() || !form.parent_phone.trim() || !form.email.trim()) {
      setError('Please fill in all required personal information fields (including student email for PWA login).')
      return
    }
    if (!form.course_id || !form.batch_id) {
      setError('Please select a Course and a Batch.')
      return
    }
    if (!instituteId) {
      setError('Institute configuration missing. Reload page.')
      return
    }

    setError('')
    setLoading(true)

    try {
      // 0. Pre-checks: Validate if email or phone is already registered to another user/student
      const cleanEmail = form.email.trim()
      const cleanPhone = form.phone.trim()

      const [existingStudent, existingUser] = await Promise.all([
        supabase.from('students').select('id, name').eq('email', cleanEmail).maybeSingle(),
        supabase.from('users').select('id, name').eq('phone', cleanPhone).maybeSingle()
      ])

      if (existingStudent.data) {
        setError(`This email (${cleanEmail}) is already registered to student: ${existingStudent.data.name}. Please use a unique email.`)
        setLoading(false)
        return
      }

      if (existingUser.data) {
        setError(`This email or phone number is already registered in the system (User: ${existingUser.data.name}). Please use a unique email and phone number.`)
        setLoading(false)
        return
      }

      // ENFORCE PLAN LIMITS
      const plan = institute?.plan || 'starter'
      const limits = { starter: 150, growth: 400, pro: 1000, enterprise: 999999 }
      const currentLimit = limits[plan] || 150

      const { count } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('institute_id', instituteId)
        .eq('status', 'active')
      
      if (count >= currentLimit) {
        setPlanLimit(currentLimit)
        setShowUpgradeModal(true)
        setLoading(false)
        return
      }

      let photoUrl = null
      // 1. Upload photo to Supabase storage if selected
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const fileName = `${instituteId}_${Date.now()}.${fileExt}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('student-photos')
          .upload(fileName, photoFile)
        
        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(fileName)
          photoUrl = urlData?.publicUrl || null
        }
      }

      const studentCode = generateStudentCode()

      // 2. Insert Student record
      const studentPayload = {
        institute_id: instituteId,
        student_code: studentCode,
        name: form.name.trim(),
        phone: form.phone.trim(),
        parent_name: form.parent_name.trim(),
        parent_phone: form.parent_phone.trim(),
        email: form.email.trim() || null,
        dob: form.dob || null,
        address: form.address.trim() || null,
        batch_id: form.batch_id,
        photo_url: photoUrl,
        status: 'active',
        enrolled_at: form.enrolled_at ? `${form.enrolled_at}T00:00:00.000Z` : new Date().toISOString(),
      }

      const { data: newStudent, error: studErr } = await supabase
        .from('students')
        .insert(studentPayload)
        .select()
        .single()

      if (studErr) throw studErr

      // 2b. Sign up the student in Supabase Auth (role = 'student')
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      )

      const studentPassword = generateSecurePassword()
      const { data: authData, error: authErr } = await tempSupabase.auth.signUp({
        email: form.email.trim(),
        password: studentPassword,
        options: {
          emailRedirectTo: window.location.origin.includes('localhost')
            ? 'https://coachpro-three.vercel.app/verified'
            : `${window.location.origin}/verified`,
          data: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            role: 'student',
            institute_id: instituteId
          }
        }
      })

      if (authErr) throw authErr

      // 2c. Create database users record to match auth immediately
      const { error: dbUserErr } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          institute_id: instituteId,
          name: form.name.trim(),
          phone: form.phone.trim(),
          role: 'student'
        })
      if (dbUserErr && dbUserErr.code !== '23505') throw dbUserErr

      setGeneratedPassword(studentPassword)
      setCreatedStudentEmail(form.email.trim())

      // 3. Auto-generate Fee Installments
      const selectedCourse = courses.find(c => c.id === form.course_id)
      const selectedStructure = feeStructures.find(f => f.id === form.fee_structure_id)
      
      let baseFee = Number(selectedStructure?.total_amount || selectedCourse?.total_fee || 10000)
      let discountVal = Number(form.discount_amount) || 0

      if (form.is_scholarship && form.scholarship_val) {
        if (form.scholarship_type === 'percent') {
          discountVal += (baseFee * Number(form.scholarship_val)) / 100
        } else {
          discountVal += Number(form.scholarship_val)
        }
      }

      const netFee = Math.max(0, baseFee - discountVal)
      const installmentCount = selectedStructure?.installments_count || 1
      const installmentAmount = Math.round(netFee / installmentCount)

      // Create installments
      const installmentsPayload = []
      const enrollDate = new Date(form.enrolled_at || Date.now())

      for (let i = 1; i <= installmentCount; i++) {
        const dueDate = new Date(enrollDate.getTime() + (i - 1) * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        installmentsPayload.push({
          institute_id: instituteId,
          student_id: newStudent.id,
          installment_number: i,
          due_date: dueDate,
          amount: i === installmentCount ? netFee - installmentAmount * (installmentCount - 1) : installmentAmount,
          status: 'pending',
          paid_amount: 0,
          notes: form.discount_reason ? `Discount applied: ${form.discount_reason}` : null
        })
      }

      if (installmentsPayload.length > 0) {
        await supabase.from('fee_installments').insert(installmentsPayload)
      }

      // 4. Create default student preferences
      try {
        await supabase.from('student_preferences').insert({
          student_id: newStudent.id,
          whatsapp_alerts: true,
          fee_reminders: true,
          attendance_alerts: true,
          exam_notifications: true
        })
      } catch (prefErr) {
        console.warn('Preferences insert fallback ignored:', prefErr)
      }

      setTempStudent(newStudent)
      setShowCredentialsModal(true)
      toast.success(`Success! Student ${newStudent.name} enrolled.`)
    } catch (err) {
      console.error('Create student error:', err)
      setError(err.message || 'Failed to enroll student.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      parent_name: '',
      parent_phone: '',
      email: '',
      dob: '',
      address: '',
      course_id: '',
      batch_id: '',
      enrolled_at: new Date().toISOString().split('T')[0],
      fee_structure_id: '',
      discount_amount: '',
      discount_reason: '',
      is_scholarship: false,
      scholarship_val: '',
      scholarship_type: 'percent',
    })
    setPhotoFile(null)
    setPhotoPreview('')
    setSubmittedStudent(null)
    setError('')
  }

  // Filtered batches based on course
  const filteredBatches = batches.filter(b => !form.course_id || b.course_id === form.course_id)

  if (submittedStudent) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <Card className="p-8 border border-green-200 shadow-xl bg-gradient-to-b from-green-50/50 to-white">
          <div className="w-16 h-16 rounded-3xl bg-[#22C55E] text-white flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Student Enrolled Successfully!</h2>
          <p className="text-gray-600 text-sm mb-6">
            <strong className="text-gray-900">{submittedStudent.name}</strong> has been enrolled with Student Code{' '}
            <span className="font-mono font-bold text-[#1E3A8A] bg-blue-50 px-2 py-0.5 rounded">{submittedStudent.student_code}</span>. Installment schedule has been generated.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={resetForm}
              icon={UserPlus}
              className="bg-white"
            >
              Add Another Student
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate(`/students/${submittedStudent.id}`)}
              iconRight={<ArrowRight size={18} />}
            >
              View Student Profile
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/students')}>
          Back to Directory
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Student Admission</h1>
          <p className="text-sm text-gray-500">Enroll a new student, assign batch, and configure fee schedule</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={18} className="text-[#1E3A8A]" />
              Personal Information
            </CardTitle>
          </CardHeader>

          <div className="space-y-4">
            {/* Photo Upload */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-[#1E3A8A] font-bold text-xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-blue-200">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <UserPlus size={24} />
                )}
              </div>
              <div>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer shadow-2xs">
                  <Upload size={14} />
                  Upload Photo
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </label>
                <p className="text-[11px] text-gray-400 mt-1">JPG, PNG up to 2MB. Optional.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={set('name')}
                required
              />
              <Input
                label="Phone Number"
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={set('phone')}
                required
              />
              <Input
                label="Parent Name"
                placeholder="e.g. Suresh Sharma"
                value={form.parent_name}
                onChange={set('parent_name')}
                required
              />
              <Input
                label="Parent Phone Number"
                placeholder="e.g. 9876543211"
                value={form.parent_phone}
                onChange={set('parent_phone')}
                required
              />
              <Input
                label="Email Address *"
                type="email"
                placeholder="e.g. rahul@example.com"
                value={form.email}
                onChange={set('email')}
                required
              />
              <Input
                label="Date of Birth"
                type="date"
                value={form.dob}
                onChange={set('dob')}
              />
            </div>
            <Input
              label="Address"
              placeholder="Full residential address..."
              value={form.address}
              onChange={set('address')}
            />
          </div>
        </Card>

        {/* Section 2: Enrollment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap size={18} className="text-[#F97316]" />
              Enrollment & Fee Configuration
            </CardTitle>
          </CardHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Course"
                placeholder="Select course"
                value={form.course_id}
                onChange={(e) => {
                  setForm({ ...form, course_id: e.target.value, batch_id: '' })
                }}
                options={courses.map(c => ({ value: c.id, label: `${c.name} (₹${(c.total_fee || 0).toLocaleString('en-IN')})` }))}
                required
              />
              <Select
                label="Batch"
                placeholder="Select batch"
                value={form.batch_id}
                onChange={set('batch_id')}
                options={filteredBatches.map(b => ({ value: b.id, label: b.name }))}
                required
              />
              <Input
                label="Enrollment Date"
                type="date"
                value={form.enrolled_at}
                onChange={set('enrolled_at')}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Select
                label="Fee Structure"
                placeholder="Select fee structure"
                value={form.fee_structure_id}
                onChange={set('fee_structure_id')}
                options={feeStructures.map(f => ({ value: f.id, label: `${f.name} (${f.installment_count || f.installments_count || 1} Installment/s)` }))}
              />
              <Input
                label="Discount Amount (₹)"
                type="number"
                placeholder="0"
                value={form.discount_amount}
                onChange={set('discount_amount')}
              />
            </div>

            {Number(form.discount_amount) > 0 && (
              <Input
                label="Discount Reason"
                placeholder="e.g. Early bird discount / Sibling waiver"
                value={form.discount_reason}
                onChange={set('discount_reason')}
              />
            )}

            {/* Scholarship Toggle */}
            <div className="p-4 bg-orange-50/60 border border-orange-100 rounded-2xl space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_scholarship}
                  onChange={setCheck('is_scholarship')}
                  className="w-4 h-4 text-[#F97316] rounded focus:ring-[#F97316]"
                />
                <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                  <Sparkles size={16} className="text-[#F97316]" /> Apply Merit Scholarship
                </span>
              </label>

              {form.is_scholarship && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Select
                    label="Scholarship Type"
                    value={form.scholarship_type}
                    onChange={set('scholarship_type')}
                    options={[
                      { value: 'percent', label: 'Percentage (%)' },
                      { value: 'fixed', label: 'Fixed Amount (₹)' }
                    ]}
                  />
                  <Input
                    label={form.scholarship_type === 'percent' ? 'Scholarship (%)' : 'Scholarship Amount (₹)'}
                    type="number"
                    placeholder={form.scholarship_type === 'percent' ? '25' : '5000'}
                    value={form.scholarship_val}
                    onChange={set('scholarship_val')}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-4 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={() => navigate('/students')}>
            Cancel
          </Button>
          <Button variant="accent" size="lg" type="submit" loading={loading} icon={UserPlus} className="shadow-lg">
            Complete Admission & Generate Fees
          </Button>
        </div>
      </form>

      {/* PLAN ENFORCEMENT UPGRADE MODAL */}
      {showUpgradeModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowUpgradeModal(false)}
          title="Student Limit Reached"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowUpgradeModal(false)}>Cancel</Button>
              <Button variant="accent" icon={Sparkles} onClick={() => navigate('/billing')}>Upgrade Plan</Button>
            </>
          }
        >
          <div className="space-y-4 text-center">
            <div className="bg-red-50 text-red-600 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <Shield size={32} />
            </div>
            <h3 className="font-extrabold text-gray-900 text-lg">Action Blocked</h3>
            <p className="text-gray-600 text-sm">
              You've reached your <strong>{institute?.plan?.toUpperCase() || 'STARTER'} plan</strong> limit of <strong>{planLimit} students</strong>.
              Please upgrade to the next tier to continue adding students.
            </p>
          </div>
        </Modal>
      )}

      {/* Temporary credentials modal */}
      {showCredentialsModal && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowCredentialsModal(false)
            setSubmittedStudent(tempStudent)
            setGeneratedPassword('')
            setCreatedStudentEmail('')
          }}
          title="Student Account Created"
          footer={
            <Button
              variant="outline"
              onClick={() => {
                setShowCredentialsModal(false)
                setSubmittedStudent(tempStudent)
                setGeneratedPassword('')
                setCreatedStudentEmail('')
              }}
            >
              Done
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-center">
              <CheckCircle2 size={36} className="text-green-600 mx-auto mb-2" />
              <h3 className="font-bold text-green-950">Registration Complete</h3>
              <p className="text-[11px] text-green-800 mt-1">An email confirmation link has been sent to their Gmail. They must click it to verify before they can log in.</p>
            </div>

            <p className="text-xs text-gray-600 font-semibold">Copy and share these temporary credentials with the student:</p>
            
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-gray-100 pb-1.5">
                <span className="text-gray-400">Email:</span>
                <span className="text-blue-900 font-bold select-all">{createdStudentEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Password:</span>
                <span className="text-orange-600 font-bold select-all">{generatedPassword}</span>
              </div>
            </div>

            <Button
              size="xs"
              variant="success"
              fullWidth
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${createdStudentEmail}\nPassword: ${generatedPassword}`)
                toast.success('Credentials copied to clipboard.')
              }}
            >
              Copy Credentials to Clipboard
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
