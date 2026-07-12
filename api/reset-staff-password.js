import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' })
  }

  const { userId, email, name, resendApiKey, resendSender } = req.body

  if (!userId || !email) {
    return res.status(400).json({ error: 'Missing required parameters: userId and email.' })
  }

  // 1. Get Supabase environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: 'Supabase Service Role Key is not configured on the Vercel server. Please add SUPABASE_SERVICE_ROLE_KEY to your Vercel project environment variables.'
    })
  }

  // 2. Initialize Supabase Admin Client
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // 3. Generate a secure temporary password
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let newPassword = ''
  for (let i = 0; i < 10; i++) {
    newPassword += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  try {
    // 4. Update the user's password in Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (authErr) throw authErr

    // 5. Update public schema row to mark as verified and clear any old cached password
    const { error: dbErr } = await supabaseAdmin
      .from('users')
      .update({
        temp_password: null,
        is_verified: true
      })
      .eq('id', userId)

    if (dbErr) throw dbErr

    // 6. Send the new password to the staff member's email using Resend
    if (resendApiKey && resendSender) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: resendSender,
          to: email,
          subject: 'Batch Desk - Password Reset Credentials',
          html: `
            <div style="font-family: sans-serif; padding: 25px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #1e3a8a; margin: 0;">Batch Desk</h2>
                <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Coaching Institute Management System</p>
              </div>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p>Hello <strong>${name || 'Team Member'}</strong>,</p>
              <p>Your password has been reset by the administrator. Your old password is now invalid.</p>
              <p>Here are your new temporary login credentials:</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px 20px; border-radius: 8px; font-family: monospace; font-size: 14px; margin: 20px 0; line-height: 1.6;">
                <strong style="color: #475569;">Email:</strong> ${email}<br/>
                <strong style="color: #475569;">New Password:</strong> ${newPassword}
              </div>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${req.headers.origin || 'https://coachpro-three.vercel.app'}/login" style="background-color: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Log In to Portal</a>
              </div>
              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">Please update your password after logging in for security.</p>
            </div>
          `
        })
      })

      if (!emailResponse.ok) {
        const mailErr = await emailResponse.json()
        throw new Error(mailErr.message || 'Resend API failed to dispatch email.')
      }
    }

    return res.status(200).json({ success: true, newPassword })
  } catch (error) {
    console.error('Password reset backend error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error during password reset.' })
  }
}
