import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Users, Upload, LayoutGrid, List, ChevronLeft, ChevronRight, Eye, Phone, User
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import { StatusBadge } from '../../components/ui/Badge'
import { TableRowSkeleton } from '../../components/ui/Skeleton'

export default function StudentList() {
  const { profile } = useAuth()
  const isStaff = profile?.role === 'staff'
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  const navigate = useNavigate()
  const instituteId = profile?.institute_id

  const [students, setStudents] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Controls
  const [search, setSearch] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('enrolled_at') // name | enrolled_at | balance_due
  const [viewMode, setViewMode] = useState('table') // table | cards
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    if (instituteId) {
      fetchStudentsAndData()

      const channel = supabase
        .channel('students-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'students', filter: `institute_id=eq.${instituteId}` },
          () => {
            fetchStudentsAndData()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [instituteId])

  const fetchStudentsAndData = async () => {
    setLoading(true)
    try {
      const isStaff = profile?.role === 'staff'

      let studentQuery = supabase
        .from('students')
        .select('*, batches(name, courses(name))')
        .eq('institute_id', instituteId)

      let batchQuery = supabase
        .from('batches')
        .select('id, name')
        .eq('institute_id', instituteId)

      let installmentsQuery = supabase
        .from('fee_installments')
        .select('student_id, amount, paid_amount, status')
        .eq('institute_id', instituteId)

      if (isStaff) {
        // Fetch batches assigned to this teacher
        const { data: myBatches } = await supabase
          .from('batches')
          .select('id')
          .eq('teacher_id', profile.id)

        const myBatchIds = (myBatches || []).map(b => b.id)

        if (myBatchIds.length === 0) {
          setStudents([])
          setBatches([])
          setLoading(false)
          return
        }

        studentQuery = studentQuery.in('batch_id', myBatchIds)
        batchQuery = batchQuery.eq('teacher_id', profile.id)

        // Fetch student IDs to filter installments
        const { data: tempStudents } = await supabase
          .from('students')
          .select('id')
          .in('batch_id', myBatchIds)
        const myStudentIds = (tempStudents || []).map(s => s.id)
        if (myStudentIds.length > 0) {
          installmentsQuery = installmentsQuery.in('student_id', myStudentIds)
        } else {
          installmentsQuery = installmentsQuery.eq('student_id', '00000000-0000-0000-0000-000000000000')
        }
      }

      const [studRes, batchRes, instRes] = await Promise.all([
        studentQuery.order('enrolled_at', { ascending: false }),
        batchQuery.order('name'),
        installmentsQuery
      ])

      const rawStudents = studRes.data || []
      const installments = instRes.data || []

      // Calculate balance due per student
      const balanceMap = {}
      installments.forEach(i => {
        if (i.status !== 'paid' && i.status !== 'waived') {
          const rem = (Number(i.amount) || 0) - (Number(i.paid_amount) || 0)
          balanceMap[i.student_id] = (balanceMap[i.student_id] || 0) + Math.max(0, rem)
        }
      })

      const formatted = rawStudents.map(s => ({
        ...s,
        balanceDue: balanceMap[s.id] || 0
      }))

      setStudents(formatted)
      setBatches(batchRes.data || [])
    } catch (err) {
      console.error('Fetch students error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter & Sort
  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      s.name?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.parent_phone?.includes(q) ||
      s.student_code?.toLowerCase().includes(q)
    const matchBatch = !batchFilter || s.batch_id === batchFilter
    const matchStatus = !statusFilter || s.status === statusFilter
    return matchSearch && matchBatch && matchStatus
  })

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'balance_due') return b.balanceDue - a.balanceDue
    return new Date(b.enrolled_at || 0) - new Date(a.enrolled_at || 0)
  })

  // Pagination
  const totalPages = Math.ceil(sortedStudents.length / pageSize) || 1
  const paginatedStudents = sortedStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Export CSV
  const exportCSV = () => {
    const headers = ['Student Code', 'Name', 'Phone', 'Parent Name', 'Parent Phone', 'Batch', 'Status', 'Balance Due (INR)', 'Enrolled Date']
    const rows = sortedStudents.map(s => {
      const formattedPhone = s.phone ? `="${s.phone}"` : '""'
      const formattedParentPhone = s.parent_phone ? `="${s.parent_phone}"` : '""'
      const formattedDate = s.enrolled_at ? `="${new Date(s.enrolled_at).toLocaleDateString('en-IN')}"` : '""'

      return [
        s.student_code || 'N/A',
        `"${s.name || ''}"`,
        formattedPhone,
        `"${s.parent_name || ''}"`,
        formattedParentPhone,
        `"${s.batches?.name || 'Unassigned'}"`,
        s.status || 'active',
        s.balanceDue,
        formattedDate
      ]
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Students_CoachPro_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const columns = [
    {
      header: 'Photo',
      key: 'photo_url',
      render: (v, row) => (
        <div className="w-9 h-9 rounded-full bg-blue-100 text-[#1E3A8A] font-bold flex items-center justify-center overflow-hidden flex-shrink-0 border border-blue-200">
          {v ? (
            <img src={v} alt={row.name} className="w-full h-full object-cover" />
          ) : (
            (row.name || 'S')[0].toUpperCase()
          )}
        </div>
      )
    },
    {
      header: 'ID',
      key: 'student_code',
      render: (v) => <span className="font-mono text-xs font-bold text-gray-500">{v || '—'}</span>
    },
    {
      header: 'Name',
      key: 'name',
      render: (v, row) => (
        <div>
          <p className="font-bold text-gray-900">{v}</p>
          {row.email && <p className="text-xs text-gray-400">{row.email}</p>}
        </div>
      )
    },
    {
      header: 'Batch',
      key: 'batch_id',
      render: (_, row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-[#1E3A8A]">
          {row.batches?.name || 'Unassigned'}
        </span>
      )
    },
    {
      header: 'Phone',
      key: 'phone',
      render: (v) => <span className="text-xs text-gray-700 font-medium">{v || '—'}</span>
    },
    {
      header: 'Parent Phone',
      key: 'parent_phone',
      render: (v, row) => (
        <div>
          <p className="text-xs text-gray-700 font-medium">{v || '—'}</p>
          {row.parent_name && <p className="text-[10px] text-gray-400">({row.parent_name})</p>}
        </div>
      )
    },
    {
      header: 'Balance Due',
      key: 'balanceDue',
      render: (v) => (
        <span className={`font-bold text-xs ${v > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {v > 0 ? `₹${v.toLocaleString('en-IN')}` : '₹0'}
        </span>
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (v) => <StatusBadge status={v || 'active'} />
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (_, row) => (
        <Button
          size="xs"
          variant="ghost"
          icon={Eye}
          onClick={() => navigate(`/students/${row.id}`)}
        >
          View
        </Button>
      )
    }
  ]

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students Directory</h1>
          <p className="text-sm text-gray-500">{students.length} students enrolled across all batches</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              icon={Upload}
              onClick={exportCSV}
              disabled={students.length === 0}
              className="bg-white"
            >
              Export CSV
            </Button>
          )}
          {!isStaff && (
            <Button
              variant="accent"
              icon={Plus}
              onClick={() => navigate('/students/new')}
              className="shadow-md"
            >
              Add Student
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search by name, phone, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
          <Select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            options={[
              { value: '', label: 'All Batches' },
              ...batches.map(b => ({ value: b.id, label: b.name }))
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'graduated', label: 'Graduated' },
            ]}
          />
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: 'enrolled_at', label: 'Sort by: Enrolled Date' },
              { value: 'name', label: 'Sort by: Name' },
              { value: 'balance_due', label: 'Sort by: Balance Due' },
            ]}
          />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span>Showing {paginatedStudents.length} of {sortedStudents.length} students</span>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white text-[#1E3A8A] shadow-2xs font-bold' : 'text-gray-400 hover:text-gray-700'}`}
              title="Table View"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'cards' ? 'bg-white text-[#1E3A8A] shadow-2xs font-bold' : 'text-gray-400 hover:text-gray-700'}`}
              title="Cards View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </Card>

      {/* Main Content: Table or Cards */}
      {loading ? (
        <TableRowSkeleton rows={5} />
      ) : sortedStudents.length === 0 ? (
        <Card className="text-center py-12">
          <Users size={48} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-800 mb-1">No students yet</h3>
          <p className="text-sm text-gray-500 mb-4">Add your first student to start managing admissions and fees.</p>
          {!isStaff && (
            <Button variant="accent" icon={Plus} onClick={() => navigate('/students/new')}>
              Add your first student →
            </Button>
          )}
        </Card>
      ) : viewMode === 'table' ? (
        <Card className="overflow-hidden">
          <Table columns={columns} data={paginatedStudents} />
        </Card>
      ) : (
        /* Mobile Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedStudents.map((s) => (
            <Card key={s.id} className="p-4 flex flex-col justify-between hover:shadow-md transition-all">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#1E3A8A] font-bold text-lg flex items-center justify-center overflow-hidden border border-blue-200 flex-shrink-0">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      (s.name || 'S')[0].toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-gray-900 truncate">{s.name}</h3>
                      <StatusBadge status={s.status || 'active'} />
                    </div>
                    <p className="text-xs text-[#1E3A8A] font-medium truncate">{s.batches?.name || 'Unassigned Batch'}</p>
                    <p className="text-[10px] font-mono text-gray-400">{s.student_code}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5 border border-gray-100">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone:</span>
                    <span className="font-medium text-gray-800">{s.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Parent ({s.parent_name || 'Guardian'}):</span>
                    <span className="font-medium text-gray-800">{s.parent_phone || '—'}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200/60 font-bold">
                    <span className="text-gray-500">Balance Due:</span>
                    <span className={s.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}>
                      {s.balanceDue > 0 ? `₹${s.balanceDue.toLocaleString('en-IN')}` : '₹0'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  icon={Eye}
                  onClick={() => navigate(`/students/${s.id}`)}
                  className="bg-white"
                >
                  View Profile
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            icon={ChevronLeft}
          >
            Previous
          </Button>
          <span className="text-xs text-gray-500 font-medium">
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            iconRight={<ChevronRight size={16} />}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
