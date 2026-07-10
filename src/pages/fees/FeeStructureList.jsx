import { useState, useEffect } from 'react'
import { Plus, CreditCard, Sparkles, Layers, Trash2, BookOpen, Users, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import { GridCardSkeleton } from '../../components/ui/Skeleton'
import FeeStructureWizard from './FeeStructureWizard'

export default function FeeStructureList() {
  const { profile } = useAuth()
  const instituteId = profile?.institute_id

  const [structures, setStructures] = useState([])
  const [loading, setLoading] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    if (instituteId) fetchStructures()
  }, [instituteId])

  const fetchStructures = async () => {
    setLoading(true)
    try {
      const [structRes, instRes] = await Promise.all([
        supabase.from('fee_structures').select('*, courses(name)').eq('institute_id', instituteId).order('created_at', { ascending: false }),
        supabase.from('fee_installments').select('student_id, fee_structure_id').eq('institute_id', instituteId)
      ])

      const raw = structRes.data || []
      const installments = instRes.data || []

      const studSetMap = {}
      installments.forEach(i => {
        if (i.fee_structure_id && i.student_id) {
          if (!studSetMap[i.fee_structure_id]) studSetMap[i.fee_structure_id] = new Set()
          studSetMap[i.fee_structure_id].add(i.student_id)
        }
      })

      const formatted = raw.map(s => ({
        ...s,
        studentCount: studSetMap[s.id]?.size || 0
      }))

      setStructures(formatted)
    } catch (err) {
      console.error('Fetch structures error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (s) => {
    if (s.studentCount > 0) {
      alert(`Cannot delete "${s.name}" because ${s.studentCount} student(s) are currently assigned to this fee structure.`)
      return
    }

    if (!window.confirm(`Delete fee structure "${s.name}"?`)) return
    try {
      await supabase.from('fee_structures').delete().eq('id', s.id)
      fetchStructures()
    } catch (err) {
      alert(`Failed to delete fee structure: ${err.message}`)
    }
  }

  if (showWizard) {
    return <FeeStructureWizard onClose={() => setShowWizard(false)} onSaved={() => { setShowWizard(false); fetchStructures() }} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Structures</h1>
          <p className="text-sm text-gray-500">Configure tuition payment schedules, installments, and payment frequencies</p>
        </div>
        <Button variant="accent" icon={Plus} onClick={() => setShowWizard(true)} className="shadow-md">
          Create Fee Structure
        </Button>
      </div>

      {loading ? (
        <GridCardSkeleton count={3} />
      ) : structures.length === 0 ? (
        <Card className="text-center py-12">
          <CreditCard size={48} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-800 mb-1">No fee structures defined</h3>
          <p className="text-sm text-gray-500 mb-4">Launch our 3-Step Fee Wizard to easily set up monthly, quarterly, or custom payment schedules.</p>
          <Button variant="accent" icon={Plus} onClick={() => setShowWizard(true)}>
            Launch Fee Wizard →
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {structures.map((s) => (
            <Card key={s.id} className="p-5 flex flex-col justify-between hover:shadow-lg transition-all border border-gray-200 bg-white">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-[#1E3A8A] border border-blue-100 mb-1.5">
                      {s.frequency ? s.frequency.replace('_', ' ') : 'Custom'}
                    </span>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight">{s.name}</h3>
                    <p className="text-xs font-semibold text-[#F97316]">{s.courses?.name || 'Linked Course'}</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 border border-blue-100">
                    <CreditCard size={18} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Total Amount</p>
                    <p className="text-base font-extrabold text-gray-900">₹{(s.total_amount || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Installments</p>
                    <p className="text-base font-extrabold text-[#1E3A8A]">{s.installments_count || 1} Terms</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-gray-500 font-medium flex items-center gap-1.5"><Users size={14} /> Active Students</span>
                  <span className="font-extrabold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-lg">{s.studentCount} Students</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
                <Button
                  size="xs"
                  variant="danger"
                  icon={Trash2}
                  onClick={() => handleDelete(s)}
                  disabled={s.studentCount > 0}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
