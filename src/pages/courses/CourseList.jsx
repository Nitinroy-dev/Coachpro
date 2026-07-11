import { useState, useEffect } from 'react'
import { Plus, BookOpen, Edit2, Trash2, Layers, Clock, DollarSign, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import { GridCardSkeleton } from '../../components/ui/Skeleton'

export default function CourseList() {
  const { profile } = useAuth()
  const instituteId = profile?.institute_id

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', duration: '', total_fee: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (instituteId) fetchCourses()
  }, [instituteId])

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const isStaff = profile?.role === 'staff'
      const [courseRes, batchRes] = await Promise.all([
        supabase.from('courses').select('*').eq('institute_id', instituteId).order('created_at', { ascending: false }),
        isStaff 
          ? supabase.from('batches').select('id, course_id, teacher_id').eq('institute_id', instituteId).eq('teacher_id', profile.id)
          : supabase.from('batches').select('id, course_id, teacher_id').eq('institute_id', instituteId)
      ])

      const rawCourses = courseRes.data || []
      const batches = batchRes.data || []

      // If user is a teacher, only include courses that have at least one batch assigned to them
      const assignedCourseIds = new Set(batches.map(b => b.course_id))
      const filteredCourses = isStaff
        ? rawCourses.filter(c => assignedCourseIds.has(c.id))
        : rawCourses

      const batchCountMap = {}
      batches.forEach(b => {
        batchCountMap[b.course_id] = (batchCountMap[b.course_id] || 0) + 1
      })

      const formatted = filteredCourses.map(c => ({
        ...c,
        batchesCount: batchCountMap[c.id] || 0
      }))

      setCourses(formatted)
    } catch (err) {
      console.error('Fetch courses error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenForm = (course = null) => {
    if (course) {
      setEditing(course)
      setForm({
        name: course.name || '',
        description: course.description || '',
        duration: course.duration || '',
        total_fee: course.total_fee || ''
      })
    } else {
      setEditing(null)
      setForm({ name: '', description: '', duration: '', total_fee: '' })
    }
    setError('')
    setShowForm(true)
  }

  const handleDelete = async (course) => {
    if (course.batchesCount > 0) {
      alert(`Cannot delete "${course.name}" because it has ${course.batchesCount} active batch(es) assigned to it. Please remove or reassign the batches first.`)
      return
    }

    if (!window.confirm(`Are you sure you want to delete the course "${course.name}"?`)) return

    try {
      const { error: delErr } = await supabase.from('courses').delete().eq('id', course.id)
      if (delErr) throw delErr
      fetchCourses()
    } catch (err) {
      alert(`Failed to delete course: ${err.message}`)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Course name is required.'); return }
    if (!form.total_fee || Number(form.total_fee) <= 0) { setError('Please enter a valid total fee.'); return }
    if (!instituteId) { setError('Institute ID missing.'); return }

    setFormLoading(true)
    setError('')

    try {
      const payload = {
        institute_id: instituteId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration: form.duration.trim() || null,
        total_fee: Number(form.total_fee),
      }

      if (editing) {
        const { error: err } = await supabase.from('courses').update(payload).eq('id', editing.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('courses').insert(payload)
        if (err) throw err
      }

      setShowForm(false)
      fetchCourses()
    } catch (err) {
      setError(err.message || 'Failed to save course.')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200">
        <Link
          to="/courses"
          className="pb-3 px-5 text-sm font-bold border-b-2 border-[#1E3A8A] text-[#1E3A8A]"
        >
          Courses
        </Link>
        <Link
          to="/batches"
          className="pb-3 px-5 text-sm font-bold border-b-2 border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200 transition-all"
        >
          Batches
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses Directory</h1>
          <p className="text-sm text-gray-500">Manage your coaching academic programs and tuition structures</p>
        </div>
        {profile?.role !== 'staff' && (
          <Button variant="accent" icon={Plus} onClick={() => handleOpenForm()} className="shadow-md">
            Add Course
          </Button>
        )}
      </div>

      {loading ? (
        <GridCardSkeleton count={3} />
      ) : courses.length === 0 ? (
        <Card className="text-center py-12">
          <BookOpen size={48} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-800 mb-1">No courses created yet</h3>
          <p className="text-sm text-gray-500 mb-4">Add your first course to start setting up batches and admitting students.</p>
          <Button variant="accent" icon={Plus} onClick={() => handleOpenForm()}>
            Add Course Now →
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <Card key={course.id} className="p-5 flex flex-col justify-between hover:shadow-lg transition-all border border-gray-200/80 bg-white">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 border border-blue-100 shadow-2xs">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 leading-tight">{course.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock size={12} /> {course.duration || 'Flexible Duration'}
                      </p>
                    </div>
                  </div>
                </div>

                {course.description && (
                  <p className="text-xs text-gray-600 line-clamp-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    {course.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 p-3 rounded-xl border border-blue-100/60">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Total Fee</p>
                    <p className="text-base font-extrabold text-[#1E3A8A]">₹{(course.total_fee || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50/50 to-fuchsia-50/30 p-3 rounded-xl border border-purple-100/60">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Batches</p>
                    <p className="text-base font-extrabold text-[#8B5CF6]">{course.batchesCount} Active</p>
                  </div>
                </div>
              </div>

              {profile?.role !== 'staff' && (
                <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
                  <Button size="xs" variant="outline" icon={Edit2} onClick={() => handleOpenForm(course)} className="bg-white">
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="danger"
                    icon={Trash2}
                    onClick={() => handleDelete(course)}
                    disabled={course.batchesCount > 0}
                    title={course.batchesCount > 0 ? "Cannot delete course with active batches" : "Delete Course"}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Course Modal */}
      {showForm && (
        <Modal
          isOpen={true}
          onClose={() => setShowForm(false)}
          title={editing ? 'Edit Course' : 'Add New Course'}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowForm(false)} disabled={formLoading}>Cancel</Button>
              <Button loading={formLoading} onClick={handleSubmit}>
                {editing ? 'Update Course' : 'Create Course'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Course Name *"
              placeholder="e.g. Class 10th Science & Math"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Description (optional)"
              placeholder="e.g. Comprehensive CBSE board prep with weekly tests..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Duration"
                placeholder="e.g. 1 Year / 6 Months"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
              <Input
                label="Total Fee (₹) *"
                type="number"
                placeholder="e.g. 25000"
                value={form.total_fee}
                onChange={(e) => setForm({ ...form, total_fee: e.target.value })}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-medium">
                {error}
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
