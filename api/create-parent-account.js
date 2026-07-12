import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { parentEmail, parentName, studentName, studentId, instituteId, redirectUrl } = req.body

  if (!parentEmail || !studentId || !instituteId) {
    return res.status(400).json({ error: 'Missing required parameters: parentEmail, studentId, instituteId.' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: 'Supabase Service Role Key is not configured. Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars.'
    })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Generate secure password
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  try {
    // 1. Check if a user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === parentEmail)

    let userId

    if (existingUser) {
      // User exists - update their password
      userId = existingUser.id
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password
      })
      if (updateErr) throw updateErr
    } else {
      // 2. Create new auth account for parent
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: parentEmail,
        password: password,
        email_confirm: false,
        user_metadata: {
          name: parentName || `Parent of ${studentName}`,
          role: 'parent',
          institute_id: instituteId,
          linked_student_id: studentId
        }
      })

      if (authErr) throw authErr
      userId = authData.user.id
    }

    // 3. Wait for auth commit
    await new Promise(resolve => setTimeout(resolve, 500))

    // 4. Upsert public.users record for parent
    const { error: dbErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        institute_id: instituteId,
        name: parentName || `Parent of ${studentName}`,
        email: parentEmail,
        role: 'parent',
        is_verified: false,
        temp_password: password,
        linked_student_id: studentId
      }, { onConflict: 'id' })

    if (dbErr) throw dbErr

    // 5. Send verification email to parent using Supabase's built-in magic link
    const finalRedirectUrl = redirectUrl || 'https://coachpro-three.vercel.app/verified'
    
    const { error: inviteErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: parentEmail,
      password: password,
      options: {
        redirectTo: finalRedirectUrl
      }
    })

    // Even if generateLink fails, the account is created. Parent can use forgot-password flow.
    if (inviteErr) {
      console.warn('Parent invite link generation warning:', inviteErr.message)
    }

    return res.status(200).json({
      success: true,
      userId,
      password,
      message: 'Parent account created successfully.'
    })
  } catch (error) {
    console.error('Create parent account error:', error)
    return res.status(500).json({ error: error.message || 'Failed to create parent account.' })
  }
}
