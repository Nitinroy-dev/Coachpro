import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { parentEmail, parentName, studentName, studentId, instituteId, resendApiKey, resendSender, redirectUrl } = req.body

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
    
    const { data: linkData, error: inviteErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: parentEmail,
      password: password,
      options: {
        redirectTo: finalRedirectUrl
      }
    })

    if (inviteErr) {
      console.warn('Parent invite link generation warning:', inviteErr.message)
    }

    const actionLink = linkData?.properties?.action_link

    // 6. Send the verification email to the parent using Resend
    if (actionLink && resendApiKey && resendSender) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: resendSender,
            to: parentEmail,
            subject: `Batch Desk - Confirm Parent Account for ${studentName}`,
            html: `
              <div style="font-family: sans-serif; padding: 25px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h2 style="color: #1e3a8a; margin: 0;">Batch Desk</h2>
                  <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Coaching Institute Management System</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p>Hello <strong>${parentName || 'Parent'}</strong>,</p>
                <p>An account has been created for you as the parent of <strong>${studentName}</strong>.</p>
                <p>To verify your email address and receive your login credentials, please click the confirmation link below:</p>
                <div style="text-align: center; margin: 25px 0;">
                  <a href="${actionLink}" style="background-color: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Confirm Email & Get Credentials</a>
                </div>
                <p style="font-size: 11px; color: #94a3b8;">If the button above does not work, copy and paste this link into your browser:</p>
                <p style="font-size: 11px; font-family: monospace; word-break: break-all; color: #64748b;">${actionLink}</p>
              </div>
            `
          })
        })
      } catch (emailErr) {
        console.error('Failed to send Resend parent verification email:', emailErr)
      }
    }

    return res.status(200).json({
      success: true,
      userId,
      password,
      message: 'Parent account created and verification email sent successfully.'
    })
  } catch (error) {
    console.error('Create parent account error:', error)
    return res.status(500).json({ error: error.message || 'Failed to create parent account.' })
  }
}
