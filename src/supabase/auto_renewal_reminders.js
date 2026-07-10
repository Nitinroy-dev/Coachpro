// Supabase Edge Function: auto-renewal-reminders
// Trigger this via pg_cron or Supabase scheduled functions daily at 9:00 AM IST

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Dummy Wati send function (similar to what you use in client)
async function sendWhatsAppMessage(phone, templateText) {
  const WATI_BASE_URL = Deno.env.get('WATI_BASE_URL')
  const WATI_API_KEY = Deno.env.get('WATI_API_KEY')
  
  if (!WATI_BASE_URL || !WATI_API_KEY) {
    console.log("WATI credentials missing, skipping WhatsApp message for:", phone)
    return
  }

  try {
    await fetch(`${WATI_BASE_URL}/api/v1/sendSessionMessage/${phone}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WATI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messageText: templateText })
    })
  } catch (err) {
    console.error("Wati Error:", err)
  }
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find active or trailing institutes
    const { data: institutes, error } = await supabase
      .from('institutes')
      .select('id, name, phone, plan, subscription_ends_at, users!inner(name, phone, role)')
      .in('subscription_status', ['active', 'trial'])

    if (error) throw error

    const now = new Date()
    
    for (const inst of institutes) {
      if (!inst.subscription_ends_at) continue

      const expiryDate = new Date(inst.subscription_ends_at)
      const diffTime = expiryDate - now
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      const admin = inst.users.find(u => u.role === 'admin') || inst.users[0]
      const ownerPhone = admin?.phone || inst.phone
      if (!ownerPhone) continue

      const paymentLink = `https://coachpro.app/billing` // App link

      if (diffDays === 7) {
        await sendWhatsAppMessage(ownerPhone, `Hi ${admin?.name || 'Owner'}, your CoachPro ${inst.plan?.toUpperCase()} subscription expires in 7 days on ${expiryDate.toLocaleDateString('en-IN')}.\nRenew now to avoid interruption:\n${paymentLink}\n— CoachPro Team`)
      } else if (diffDays === 3) {
        await sendWhatsAppMessage(ownerPhone, `⚠️ CoachPro reminder: 3 days left on your ${inst.plan?.toUpperCase()} subscription.\nRenew here: ${paymentLink}`)
      } else if (diffDays === 1) {
        await sendWhatsAppMessage(ownerPhone, `🚨 Last day! CoachPro subscription expires tomorrow. Renew to keep access to your students, fees & attendance data.\n${paymentLink}`)
      } else if (diffDays === 0) {
        await sendWhatsAppMessage(ownerPhone, `Your CoachPro subscription has ended today.\nYour data is safe. Renew within 30 days:\n${paymentLink}\nAfter 30 days data will be deleted.`)
        // Update status to expired
        await supabase.from('institutes').update({ subscription_status: 'expired' }).eq('id', inst.id)
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Reminders processed" }), { headers: { "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
