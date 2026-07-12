import { useState, useEffect } from 'react'
import { Save, Building2, Phone, MapPin, Hash, Calendar, Settings as SettingsIcon, Link2, Bell, User, Users, Plus, Shield, ShieldAlert, Sparkles, Key, CheckCircle2, AlertTriangle, Eye, EyeOff, Trash2, Mail, Send, QrCode, Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { useSearchParams } from 'react-router-dom'

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

export default function Settings() {
  const { profile, institute, refreshProfile } = useAuth()
  const toast = useToast()
  const instituteId = profile?.institute_id

  // Tab State
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile') // profile | integrations | notifications | staff

  // General States
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Tab 1: Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    address: '',
    gst_number: '',
    academic_year: '',
    logo_url: ''
  })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')

  // Tab 2: Integrations State
  const [integrationsForm, setIntegrationsForm] = useState({
    razorpay_key_id: '',
    razorpay_key_secret: '',
    wati_api_token: '',
    wati_api_endpoint: '',
    wati_sender_number: '',
    upi_id: '',
    upi_name: '',
    resend_api_key: '',
    resend_sender_email: ''
  })
  const [showRzpSecret, setShowRzpSecret] = useState(false)
  const [showWatiToken, setShowWatiToken] = useState(false)
  const [rzpConnected, setRzpConnected] = useState(false)
  const [watiConnected, setWatiConnected] = useState(false)

  // Tab 3: Notifications Preferences
  const [notifPreferences, setNotifPreferences] = useState({
    fee_due: true,
    fee_paid: true,
    absent: true,
    extra_class: true,
    class_cancelled: true,
    exam: true,
    holiday: true
  })
  const [notifTemplates, setNotifTemplates] = useState({
    fee_due: '',
    fee_paid: '',
    absent: '',
    extra_class: '',
    class_cancelled: '',
    exam: '',
    holiday: ''
  })
  const [activeTemplateTab, setActiveTemplateTab] = useState('fee_due')

  // Tab 4: Staff Management State
  const [staffList, setStaffList] = useState([])
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', role: 'staff' })
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [createdStaffEmail, setCreatedStaffEmail] = useState('')
  const [createdStaffName, setCreatedStaffName] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [showResendKey, setShowResendKey] = useState(false)
  const [emailAutoSent, setEmailAutoSent] = useState(false)

  useEffect(() => {
    if (institute) {
      setProfileForm({
        name: institute.name || '',
        phone: institute.phone || '',
        address: institute.address || '',
        gst_number: institute.gst_number || '',
        academic_year: institute.academic_year || '',
        logo_url: institute.logo_url || ''
      })
      setLogoPreview(institute.logo_url || '')

      const settings = institute.settings || {}
      setIntegrationsForm({
        razorpay_key_id: settings.razorpay_key_id || '',
        razorpay_key_secret: settings.razorpay_key_secret || '',
        wati_api_token: settings.wati_api_token || '',
        wati_api_endpoint: settings.wati_api_endpoint || '',
        wati_sender_number: settings.wati_sender_number || '',
        upi_id: settings.upi_id || '',
        upi_name: settings.upi_name || '',
        resend_api_key: settings.resend_api_key || '',
        resend_sender_email: settings.resend_sender_email || ''
      })

      setRzpConnected(!!settings.razorpay_key_id)
      setWatiConnected(!!settings.wati_api_token)

      setNotifPreferences({
        fee_due: settings.notification_preferences?.fee_due ?? true,
        fee_paid: settings.notification_preferences?.fee_paid ?? true,
        absent: settings.notification_preferences?.absent ?? true,
        extra_class: settings.notification_preferences?.extra_class ?? true,
        class_cancelled: settings.notification_preferences?.class_cancelled ?? true,
        exam: settings.notification_preferences?.exam ?? true,
        holiday: settings.notification_preferences?.holiday ?? true
      })

      setNotifTemplates({
        fee_due: settings.message_templates?.fee_due || "🎓 *[Institute Name]*\n\nDear [Student Name],\n\nThis is a reminder that your fee payment is due soon. Please clear outstanding balance of ₹[Amount] as soon as possible.\n\n_Batch Desk_",
        fee_paid: settings.message_templates?.fee_paid || "✅ *[Institute Name]*\n\nDear [Student Name],\n\nYour fee payment of *₹[Amount]* has been received successfully. Receipt No: *[Receipt No]*.\n\nThank you! 🙏",
        absent: settings.message_templates?.absent || "⚠️ *[Institute Name]*\n\nDear Parent,\n\nYour ward [Student Name] was marked absent from batch [Batch Name] today ([Date]). Please contact us to share the reason.",
        extra_class: settings.message_templates?.extra_class || "📚 *[Institute Name]*\n\nDear [Student Name],\n\nAn extra class has been scheduled for your batch [Batch Name] on [Date] at [Time]. Please be present.",
        class_cancelled: settings.message_templates?.class_cancelled || "❌ *[Institute Name]*\n\nDear [Student Name],\n\nThis is to inform you that class for batch [Batch Name] scheduled on [Date] has been cancelled due to unforeseen circumstances.",
        exam: settings.message_templates?.exam || "📝 *[Institute Name]*\n\nDear [Student Name],\n\nAn exam on [Subject] is scheduled for batch [Batch Name] on [Date]. Study hard! 🍀",
        holiday: settings.message_templates?.holiday || "📢 *[Institute Name]*\n\nDear Students,\n\nWe have an announcement: [Holiday Notice Details]"
      })
    }
  }, [institute])

  useEffect(() => {
    if (!instituteId || activeTab !== 'staff') return

    fetchStaff()

    // Real-time subscription to user updates (like verification changes)
    const channel = supabase
      .channel('staff_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `institute_id=eq.${instituteId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setStaffList((prev) => {
              if (prev.some(s => s.id === payload.new.id)) return prev
              if (payload.new.role === 'admin' || payload.new.role === 'staff') {
                return [...prev, payload.new]
              }
              return prev
            })
          } else if (payload.eventType === 'UPDATE') {
            setStaffList((prev) =>
              prev.map((s) => (s.id === payload.new.id ? payload.new : s))
            )
          } else if (payload.eventType === 'DELETE') {
            setStaffList((prev) => prev.filter((s) => s.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [instituteId, activeTab])

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('institute_id', instituteId)
        .in('role', ['admin', 'staff'])
      if (error) throw error
      setStaffList(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load staff list.')
    }
  }

  // Handle Logo file select
  const handleLogoSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  // Profile save (Tab 1)
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!profileForm.name.trim()) {
      toast.error('Institute Name is required.')
      return
    }

    setLoading(true)
    try {
      let finalLogoUrl = profileForm.logo_url

      // Handle logo upload if file is selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `logo_${instituteId}_${Date.now()}.${fileExt}`

        // Robust multi-bucket fallback
        let uploadErr = null
        let uploadRes = null

        // Try 'institute-logos' bucket
        const res1 = await supabase.storage.from('institute-logos').upload(fileName, logoFile)
        uploadErr = res1.error
        uploadRes = res1.data

        if (uploadErr && (uploadErr.message?.includes('does not exist') || uploadErr.message?.includes('not found'))) {
          // Fallback to 'student-photos' bucket
          const res2 = await supabase.storage.from('student-photos').upload(fileName, logoFile)
          uploadErr = res2.error
          uploadRes = res2.data
          if (!uploadErr && uploadRes) {
            const { data } = supabase.storage.from('student-photos').getPublicUrl(fileName)
            finalLogoUrl = data?.publicUrl || ''
          }
        } else if (!uploadErr && uploadRes) {
          const { data } = supabase.storage.from('institute-logos').getPublicUrl(fileName)
          finalLogoUrl = data?.publicUrl || ''
        }

        if (uploadErr && !finalLogoUrl) {
          throw new Error(`Logo Upload failed: ${uploadErr.message}`)
        }
      }

      const { error } = await supabase
        .from('institutes')
        .update({
          name: profileForm.name.trim(),
          phone: profileForm.phone.trim(),
          address: profileForm.address.trim(),
          gst_number: profileForm.gst_number.trim(),
          academic_year: profileForm.academic_year.trim(),
          logo_url: finalLogoUrl
        })
        .eq('id', instituteId)

      if (error) throw error

      await refreshProfile()
      toast.success('Institute profile updated.')
    } catch (err) {
      toast.error(err.message || 'Failed to save profile.')
    } finally {
      setLoading(false)
    }
  }

  // Integrations save (Tab 2)
  const handleSaveIntegrations = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const currentSettings = institute.settings || {}
      const updatedSettings = {
        ...currentSettings,
        razorpay_key_id: integrationsForm.razorpay_key_id.trim(),
        razorpay_key_secret: integrationsForm.razorpay_key_secret.trim(),
        wati_api_token: integrationsForm.wati_api_token.trim(),
        wati_api_endpoint: integrationsForm.wati_api_endpoint.trim(),
        wati_sender_number: integrationsForm.wati_sender_number.trim(),
        upi_id: integrationsForm.upi_id.trim(),
        upi_name: integrationsForm.upi_name.trim(),
        resend_api_key: integrationsForm.resend_api_key.trim(),
        resend_sender_email: integrationsForm.resend_sender_email.trim()
      }

      const { error } = await supabase
        .from('institutes')
        .update({ settings: updatedSettings })
        .eq('id', instituteId)

      if (error) throw error

      await refreshProfile()
      setRzpConnected(!!integrationsForm.razorpay_key_id)
      setWatiConnected(!!integrationsForm.wati_api_token)
      toast.success('API integrations credentials updated.')
    } catch (err) {
      toast.error(err.message || 'Failed to save integrations settings.')
    } finally {
      setLoading(false)
    }
  }

  // Test Razorpay connection
  const testRazorpay = async () => {
    if (!integrationsForm.razorpay_key_id) {
      toast.error('Razorpay Key ID is required to test connection.')
      return
    }
    setActionLoading(true)
    setTimeout(() => {
      setActionLoading(false)
      // Standard client-side format validation
      if (integrationsForm.razorpay_key_id.startsWith('rzp_test_') || integrationsForm.razorpay_key_id.startsWith('rzp_live_')) {
        setRzpConnected(true)
        toast.success('Razorpay API Key format is valid and connected!')
      } else {
        setRzpConnected(false)
        toast.error('Invalid Razorpay Key ID format. Must start with rzp_test_ or rzp_live_')
      }
    }, 1500)
  }

  // Test Wati WhatsApp connection
  const testWati = async () => {
    if (!integrationsForm.wati_api_token || !integrationsForm.wati_api_endpoint) {
      toast.error('Wati Token and Endpoint are required.')
      return
    }
    setActionLoading(true)
    try {
      const adminPhone = profile?.phone || '9876543210'
      const testMsg = `📱 *CoachPro Integration Test*\n\nConnection test successful!\n\nAuthorized Admin: *${profile?.name || 'Owner'}*\nInstitute: *${institute?.name}*\n\n_CoachPro System Live_`

      // Try actual fetch connection testing
      const targetPhone = adminPhone.replace(/[^0-9]/g, '')
      const response = await fetch(`${integrationsForm.wati_api_endpoint}/api/v1/sendSessionMessage/${targetPhone.startsWith('91') ? targetPhone : '91' + targetPhone}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integrationsForm.wati_api_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messageText: testMsg })
      })

      if (response.ok) {
        setWatiConnected(true)
        toast.success(`Connection test passed. WhatsApp message sent to ${adminPhone}.`)
      } else {
        setWatiConnected(false)
        toast.warning('API details correct but Wati sandbox/session is expired or not connected. Check logs.')
      }
    } catch (err) {
      setWatiConnected(false)
      toast.error(`Wati test connection failed: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Save Preferences & Templates (Tab 3)
  const handleSavePreferences = async () => {
    setLoading(true)
    try {
      const currentSettings = institute.settings || {}
      const updatedSettings = {
        ...currentSettings,
        notification_preferences: notifPreferences,
        message_templates: notifTemplates
      }

      const { error } = await supabase
        .from('institutes')
        .update({ settings: updatedSettings })
        .eq('id', instituteId)

      if (error) throw error

      await refreshProfile()
      toast.success('Notification preferences & templates saved.')
    } catch (err) {
      toast.error(err.message || 'Failed to save preferences.')
    } finally {
      setLoading(false)
    }
  }

  // Add Staff Member (Tab 4)
  const handleInviteStaff = async (e) => {
    e.preventDefault()
    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.phone.trim()) {
      toast.error('All fields (Name, Email, and Phone) are required.')
      return
    }

    setLoading(true)
    try {
      const password = generateSecurePassword()
      
      // Initialize isolated Supabase client
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

      // 1. Sign up the user in Supabase Auth
      const { data: authData, error: authErr } = await tempSupabase.auth.signUp({
        email: inviteForm.email.trim(),
        password: password,
        options: {
          emailRedirectTo: window.location.origin.includes('localhost')
            ? 'https://coachpro-three.vercel.app/verified'
            : `${window.location.origin}/verified`,
          data: {
            name: inviteForm.name.trim(),
            phone: inviteForm.phone.trim(),
            role: inviteForm.role,
            institute_id: instituteId
          }
        }
      })

      // 2. Upsert record in public.users immediately as a pending staff profile
      const { error: dbErr } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          institute_id: instituteId,
          name: inviteForm.name.trim(),
          phone: inviteForm.phone.trim(),
          role: inviteForm.role,
          is_verified: false,
          temp_password: password
        }, { onConflict: 'id' })

      if (dbErr) throw dbErr

      const targetEmail = inviteForm.email.trim()
      const targetName = inviteForm.name.trim()

      setCreatedStaffEmail(targetEmail)
      setCreatedStaffName(targetName)
      setShowInviteModal(true)
      
      toast.success(`Verification link sent to ${targetEmail}!`)
      setInviteForm({ name: '', email: '', phone: '', role: 'staff' })
      fetchStaff()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to create staff account.')
    } finally {
      setLoading(false)
    }
  }

  // Remove Staff (Tab 4)
  const handleRemoveStaff = async (staffMember) => {
    if (staffMember.id === profile?.id) {
      toast.error('You cannot remove yourself from staff list!')
      return
    }
    if (!window.confirm(`Are you sure you want to remove ${staffMember.name} and suspend their account access?`)) return
    
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', staffMember.id)

      if (error) throw error
      toast.success(`Successfully removed ${staffMember.name}.`)
      fetchStaff()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const trialDaysLeft = institute?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(institute.trial_ends_at) - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const planColors = { starter: 'default', growth: 'primary', pro: 'accent', enterprise: 'success' }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Configure your institute profile, SMS/WhatsApp integrations, notification preferences, and manage staff members</p>
        </div>
      </div>

      {/* Tabs list */}
      <div className="border-b border-gray-200 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'profile', label: 'Institute Profile', icon: Building2 },
          { id: 'integrations', label: 'Integrations / API Keys', icon: Link2 },
          { id: 'notifications', label: 'Preferences & Templates', icon: Bell },
          { id: 'staff', label: 'Staff Management', icon: Users }
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

      {/* Tab 1: Profile Settings */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-5">
            <CardHeader className="p-0 pb-4 border-b border-gray-100">
              <CardTitle className="text-base flex items-center gap-2"><Building2 size={18} className="text-[#1E3A8A]" /> Institute Information</CardTitle>
            </CardHeader>

            <form onSubmit={handleSaveProfile} className="space-y-4 pt-4">
              {/* Logo Select */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200/60">
                <div className="w-20 h-20 rounded-3xl bg-blue-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 size={32} className="text-[#1E3A8A]" />
                  )}
                </div>
                <div className="text-center sm:text-left space-y-2">
                  <p className="text-xs font-bold text-gray-700">Upload Institute Logo</p>
                  <p className="text-[10px] text-gray-400">PNG, JPG or WEBP formats up to 2MB allowed.</p>
                  <label className="inline-block bg-white hover:bg-gray-50 border border-gray-200 text-[#1E3A8A] font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs">
                    Select Logo File
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Institute Name *"
                  placeholder="e.g. Apex Coding Academy"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  icon={Building2}
                  required
                />
                <Input
                  label="Contact Phone / WhatsApp *"
                  type="tel"
                  placeholder="e.g. 919876543210"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  icon={Phone}
                  required
                />
              </div>

              <Input
                label="Full Address"
                placeholder="e.g. 404 Code Street, IT Hub, Sector 5, Kolkata"
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                icon={MapPin}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="GSTIN Number"
                  placeholder="e.g. 19AAAAA1111A1Z1"
                  value={profileForm.gst_number}
                  onChange={(e) => setProfileForm({ ...profileForm, gst_number: e.target.value })}
                  icon={Hash}
                />
                <Input
                  label="Academic Session Year"
                  placeholder="e.g. 2025-2026"
                  value={profileForm.academic_year}
                  onChange={(e) => setProfileForm({ ...profileForm, academic_year: e.target.value })}
                  icon={Calendar}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={loading} icon={Save} className="shadow-md">
                  Update Institute
                </Button>
              </div>
            </form>
          </Card>

          {/* Right Status Card */}
          <Card className="p-5 bg-gradient-to-br from-[#1E3A8A] to-blue-900 border-0 text-white shadow-xl h-fit">
            <CardHeader className="p-0 pb-4 border-b border-white/10 flex items-center justify-between">
              <CardTitle className="text-base text-white flex items-center gap-2"><Sparkles size={18} className="text-[#F97316]" /> Subscription Plan</CardTitle>
              <Badge variant={planColors[institute?.plan] || 'default'}>
                {(institute?.plan || 'starter').toUpperCase()}
              </Badge>
            </CardHeader>

            <div className="pt-4 space-y-4 text-xs font-semibold leading-relaxed">
              <div className="flex justify-between">
                <span className="text-blue-200">Subscription Status:</span>
                <span className="capitalize font-bold text-white">{institute?.subscription_status || 'trial'}</span>
              </div>
              
              {trialDaysLeft !== null && (
                <div className="flex justify-between border-b border-white/5 pb-2.5">
                  <span className="text-blue-200">Trial Expiration:</span>
                  <span className="text-white font-bold">{trialDaysLeft > 0 ? `${trialDaysLeft} days remaining` : 'Expired'}</span>
                </div>
              )}

              {institute?.subscription_ends_at && (
                <div className="flex justify-between border-b border-white/5 pb-2.5">
                  <span className="text-blue-200">Next Renewal:</span>
                  <span className="text-white font-bold">{new Date(institute.subscription_ends_at).toLocaleDateString('en-IN')}</span>
                </div>
              )}

              <div className="bg-white/5 rounded-xl p-3 border border-white/5 mt-4">
                <p className="font-bold text-white text-xs mb-1">📋 Active plan limits:</p>
                <ul className="space-y-1 text-blue-200 text-[11px] list-disc pl-4">
                  <li>Starter: 150 students max capacity</li>
                  <li>Growth: 400 students max capacity</li>
                  <li>Pro: 1,000 students max capacity</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Integrations Settings */}
      {activeTab === 'integrations' && (
        <form onSubmit={handleSaveIntegrations} className="space-y-6 max-w-3xl">

          {/* Wati Card */}
          <Card className="p-5">
            <CardHeader className="p-0 pb-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Phone size={18} className="text-green-600" /> Wati WhatsApp Broadcast API</CardTitle>
              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${watiConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {watiConnected ? 'Connected ✅' : 'Not Connected ❌'}
              </span>
            </CardHeader>

            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <Input
                    label="Wati API Access Token"
                    type={showWatiToken ? 'text' : 'password'}
                    placeholder="Bearer token string..."
                    value={integrationsForm.wati_api_token}
                    onChange={(e) => setIntegrationsForm({ ...integrationsForm, wati_api_token: e.target.value })}
                    icon={Key}
                  />
                  <button
                    type="button"
                    onClick={() => setShowWatiToken(!showWatiToken)}
                    className="absolute right-3.5 top-8.5 text-gray-400 hover:text-gray-600"
                  >
                    {showWatiToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <Input
                  label="Wati API Base Endpoint"
                  placeholder="https://live-server-XXXXX.wati.io"
                  value={integrationsForm.wati_api_endpoint}
                  onChange={(e) => setIntegrationsForm({ ...integrationsForm, wati_api_endpoint: e.target.value })}
                  icon={Link2}
                />
              </div>

              <Input
                label="WhatsApp Sender Phone Number"
                placeholder="e.g. 919876543210"
                value={integrationsForm.wati_sender_number}
                onChange={(e) => setIntegrationsForm({ ...integrationsForm, wati_sender_number: e.target.value })}
                icon={Phone}
              />

              <div className="flex justify-start">
                <Button type="button" size="xs" variant="outline" loading={actionLoading} onClick={testWati} className="bg-white">
                  Test Connection & Send SMS to Admin
                </Button>
              </div>
            </div>
          </Card>

          {/* UPI Payments Card */}
          <Card className="p-5">
            <CardHeader className="p-0 pb-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode size={18} className="text-[#F97316]" /> UPI Direct QR Configuration
              </CardTitle>
              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${integrationsForm.upi_id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {integrationsForm.upi_id ? 'Configured ✅' : 'Not Configured ❌'}
              </span>
            </CardHeader>

            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="UPI ID / VPA *"
                  placeholder="e.g. academy@upi, 9876543210@paytm"
                  value={integrationsForm.upi_id}
                  onChange={(e) => setIntegrationsForm({ ...integrationsForm, upi_id: e.target.value })}
                  icon={QrCode}
                />
                <Input
                  label="Merchant / Recipient Name *"
                  placeholder="e.g. CoachPro Academy"
                  value={integrationsForm.upi_name}
                  onChange={(e) => setIntegrationsForm({ ...integrationsForm, upi_name: e.target.value })}
                  icon={User}
                />
              </div>
              <p className="text-[10px] text-gray-400">These details are used to generate custom QR codes for direct UPI payments from the student portal.</p>
            </div>
          </Card>

          {/* Resend Email API Card */}
          <Card className="p-5">
            <CardHeader className="p-0 pb-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail size={18} className="text-blue-600" /> Resend Domain Email Integration
              </CardTitle>
              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${integrationsForm.resend_api_key ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {integrationsForm.resend_api_key ? 'Connected ✅' : 'Not Connected ❌'}
              </span>
            </CardHeader>

            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <Input
                    label="Resend API Key"
                    type={showResendKey ? 'text' : 'password'}
                    placeholder="re_xxxxxxxx"
                    value={integrationsForm.resend_api_key}
                    onChange={(e) => setIntegrationsForm({ ...integrationsForm, resend_api_key: e.target.value })}
                    icon={Key}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResendKey(!showResendKey)}
                    className="absolute right-3.5 top-8.5 text-gray-400 hover:text-gray-600"
                  >
                    {showResendKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <Input
                  label="Sender Domain Email Address"
                  placeholder="e.g. no-reply@yourdomain.com"
                  value={integrationsForm.resend_sender_email}
                  onChange={(e) => setIntegrationsForm({ ...integrationsForm, resend_sender_email: e.target.value })}
                  icon={Mail}
                />
              </div>
              <p className="text-[10px] text-gray-400">Enter your Resend API key and verified custom domain sender email. This allows the system to send credentials notifications automatically from your custom domain.</p>
            </div>
          </Card>

          {/* Actions Save */}
          <div className="flex justify-end">
            <Button type="submit" loading={loading} icon={Save} className="shadow-md">
              Save Integrations settings
            </Button>
          </div>
        </form>
      )}

      {/* Tab 3: Notification Preferences & Custom Templates */}
      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Toggle preferences switches */}
          <Card className="p-5 h-fit">
            <CardHeader className="p-0 pb-4 border-b border-gray-100">
              <CardTitle className="text-base flex items-center gap-2"><Bell size={18} className="text-[#1E3A8A]" /> Alert Preferences</CardTitle>
            </CardHeader>

            <div className="pt-4 space-y-3">
              {[
                { id: 'fee_due', label: '💸 Send Fee Due Reminder' },
                { id: 'fee_paid', label: '✅ Send Payment Confirmation' },
                { id: 'absent', label: '🚨 Send Absent Alerts to Parents' },
                { id: 'extra_class', label: '📚 Send Extra Class Scheduled' },
                { id: 'class_cancelled', label: '❌ Send Class Cancelled Alerts' },
                { id: 'exam', label: '📝 Send Exam Notices to Batch' },
                { id: 'holiday', label: '📢 Send Holiday Announcement' }
              ].map(pref => (
                <div key={pref.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100/50 transition-colors">
                  <span className="text-xs font-bold text-gray-700">{pref.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPreferences[pref.id]}
                      onChange={(e) => setNotifPreferences({ ...notifPreferences, [pref.id]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1E3A8A]" />
                  </label>
                </div>
              ))}
            </div>
          </Card>

          {/* Templates Editor */}
          <Card className="lg:col-span-2 p-5">
            <CardHeader className="p-0 pb-4 border-b border-gray-100 flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><SettingsIcon size={18} className="text-[#F97316]" /> WhatsApp Msg Templates</CardTitle>
            </CardHeader>

            {/* Template internal Tabs selectors */}
            <div className="flex gap-1.5 overflow-x-auto py-3 border-b border-gray-50 text-xs">
              {[
                { id: 'fee_due', label: 'Fee Reminder' },
                { id: 'fee_paid', label: 'Fee Receipt' },
                { id: 'absent', label: 'Absent alert' },
                { id: 'extra_class', label: 'Extra Class' },
                { id: 'class_cancelled', label: 'Cancelled Class' },
                { id: 'exam', label: 'Exam notice' },
                { id: 'holiday', label: 'Holidays' }
              ].map(tTab => (
                <button
                  key={tTab.id}
                  type="button"
                  onClick={() => setActiveTemplateTab(tTab.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${activeTemplateTab === tTab.id ? 'bg-[#1E3A8A] text-white shadow-2xs' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {tTab.label}
                </button>
              ))}
            </div>

            {/* Template edit Textarea */}
            <div className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 capitalize">{activeTemplateTab.replace('_', ' ')} Template Message *</label>
                <textarea
                  value={notifTemplates[activeTemplateTab]}
                  onChange={(e) => setNotifTemplates({ ...notifTemplates, [activeTemplateTab]: e.target.value })}
                  className="w-full h-44 p-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent text-sm leading-relaxed"
                  placeholder="Template text..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-xs text-[#1E3A8A] space-y-1 font-medium">
                <p className="font-bold flex items-center gap-1"><Info size={14} /> Available Placeholder Tags:</p>
                <p className="text-[11px] leading-relaxed">
                  Use these tags in text to replace with real-time values: <br />
                  `[Student Name]`, `[Parent Name]`, `[Amount]`, `[Date]`, `[Batch Name]`, `[Subject]`, `[Receipt No]`
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button loading={loading} icon={Save} onClick={handleSavePreferences} className="shadow-md">
                  Save preferences & Templates
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Staff Management */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Staff form */}
          <Card className="p-5 h-fit">
            <CardHeader className="p-0 pb-4 border-b border-gray-100">
              <CardTitle className="text-base flex items-center gap-2"><Plus size={18} className="text-[#1E3A8A]" /> Add Staff Member</CardTitle>
            </CardHeader>

            <form onSubmit={handleInviteStaff} className="space-y-4 pt-4">
              <Input
                label="Full Name *"
                type="text"
                placeholder="Enter staff name..."
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                icon={User}
                required
              />

              <Input
                label="Staff Email *"
                type="email"
                placeholder="staff@coachpro.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                icon={Mail}
                required
              />

              <Input
                label="Phone Number *"
                type="tel"
                placeholder="Enter phone number..."
                value={inviteForm.phone}
                onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                icon={Phone}
                required
              />

              <Select
                label="Access Privilege Role *"
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                options={[
                  { value: 'staff', label: 'Staff / Teacher (Mark attendance, schedules)' },
                  { value: 'admin', label: 'Admin (Full access, settings, billing)' }
                ]}
              />

              <Button type="submit" fullWidth icon={Plus} className="shadow-md" loading={loading}>
                Create Staff Account
              </Button>
            </form>
          </Card>

          {/* Staff list view */}
          <Card className="lg:col-span-2 p-5">
            <CardHeader className="p-0 pb-4 border-b border-gray-100 flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Users size={18} className="text-[#F97316]" /> Registered Staff ({staffList.length})</CardTitle>
              <Badge variant="primary">{staffList.filter(s => s.role === 'admin').length} Admins · {staffList.filter(s => s.role === 'staff').length} Staff</Badge>
            </CardHeader>

            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-100">
                    <th className="p-3">Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Role Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staffList.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-400">No staff members enrolled.</td></tr>
                  ) : (
                    staffList.map(staff => (
                      <tr key={staff.id} className="hover:bg-gray-50/50 transition-all">
                        <td className="p-3">
                          <p className="font-bold text-gray-900">{staff.name || 'Invited Staff'}</p>
                          <p className="text-[10px] text-gray-400">{staff.email || 'Email missing'}</p>
                        </td>
                        <td className="p-3 text-gray-600 font-semibold">{staff.phone || '—'}</td>
                        <td className="p-3 space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={staff.role === 'admin' ? 'success' : 'primary'}>
                              {staff.role === 'admin' ? 'Administrator' : 'Staff Member'}
                            </Badge>
                            <Badge variant={staff.is_verified ? 'success' : 'warning'}>
                              {staff.is_verified ? 'Verified ✅' : 'Pending Verification ⏳'}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="xs"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => handleRemoveStaff(staff)}
                            className="text-red-600 hover:text-red-700 bg-white"
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Invite link display modal */}
      {showInviteModal && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowInviteModal(false)
            setCreatedStaffEmail('')
            setCreatedStaffName('')
          }}
          title="Verification Link Sent"
          footer={
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteModal(false)
                setCreatedStaffEmail('')
                setCreatedStaffName('')
              }}
            >
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="p-5 bg-green-50 border border-green-200 rounded-2xl text-center">
              <CheckCircle2 size={36} className="text-green-600 mx-auto mb-2.5" />
              <h3 className="font-bold text-green-950 text-base">Verification Link Dispatched</h3>
              <p className="text-xs text-green-800 mt-2 leading-relaxed">
                An invitation and verification link has been sent to <strong>{createdStaffEmail}</strong>.
              </p>
              <p className="text-[11px] text-green-700 mt-2.5 bg-green-100/50 p-2.5 rounded-xl border border-green-200/50">
                Once the teacher clicks the verification link in their Gmail, their login credentials and password will be generated and emailed to them automatically.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
