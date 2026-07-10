import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import { Save } from 'lucide-react'

export default function StudentForm({ student, batches = [], onClose, onSaved }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    name: student?.name || '',
    phone: student?.phone || '',
    email: student?.email || '',
    parent_name: student?.parent_name || '',
    parent_phone: student?.parent_phone || '',
    dob: student?.dob || '',
    address: student?.address || '',
    batch_id: student?.batch_id || '',
    status: student?.status || 'active',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const generateCode = () => {
    const prefix = 'STU'
    const num = Math.floor(1000 + Math.random() * 9000)
    const year = new Date().getFullYear().toString().slice(-2)
    return `${prefix}${year}${num}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // 1. Sanitization: Strip HTML tags to prevent payload injection attempts
    const sanitize = (val) => val.replace(/<[^>]*>/g, '').trim()
    
    const cleanName = sanitize(form.name)
    const cleanEmail = sanitize(form.email)
    const cleanPhone = sanitize(form.phone)
    const cleanParentName = sanitize(form.parent_name)
    const cleanParentPhone = sanitize(form.parent_phone)
    const cleanAddress = sanitize(form.address)

    // 2. Input Validation Checks
    if (!cleanName) {
      setError('Student name is required.')
      return
    }
    if (cleanName.length > 80) {
      setError('Student name cannot exceed 80 characters.')
      return
    }
    if (cleanPhone && !/^\+?[0-9\s-]{10,15}$/.test(cleanPhone)) {
      setError('Please enter a valid 10 to 15-digit phone number.')
      return
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }
    if (cleanParentPhone && !/^\+?[0-9\s-]{10,15}$/.test(cleanParentPhone)) {
      setError('Please enter a valid 10 to 15-digit parent phone number.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const payload = {
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        parent_name: cleanParentName,
        parent_phone: cleanParentPhone,
        dob: form.dob,
        address: cleanAddress,
        status: form.status,
        institute_id: profile?.institute_id,
        student_code: student?.student_code || generateCode(),
        batch_id: form.batch_id || null,
      }

      let error
      if (student) {
        ;({ error } = await supabase.from('students').update(payload).eq('id', student.id))
      } else {
        ;({ error } = await supabase.from('students').insert(payload))
      }

      if (error) throw error
      onSaved?.()
    } catch (err) {
      setError(err.message || 'Failed to save student.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={student ? 'Edit Student' : 'Add New Student'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button icon={Save} loading={loading} onClick={handleSubmit}>
            {student ? 'Save Changes' : 'Add Student'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            placeholder="Student's full name"
            value={form.name}
            onChange={set('name')}
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            placeholder="10-digit number"
            value={form.phone}
            onChange={set('phone')}
          />
          <Input
            label="Email"
            type="email"
            placeholder="student@email.com"
            value={form.email}
            onChange={set('email')}
          />
          <Input
            label="Date of Birth"
            type="date"
            value={form.dob}
            onChange={set('dob')}
          />
          <Input
            label="Parent/Guardian Name"
            placeholder="Parent's name"
            value={form.parent_name}
            onChange={set('parent_name')}
          />
          <Input
            label="Parent Phone"
            type="tel"
            placeholder="Parent's number"
            value={form.parent_phone}
            onChange={set('parent_phone')}
          />
        </div>

        <Input
          label="Address"
          placeholder="Full address"
          value={form.address}
          onChange={set('address')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Batch"
            placeholder="Select batch"
            value={form.batch_id}
            onChange={set('batch_id')}
            options={batches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={set('status')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}
