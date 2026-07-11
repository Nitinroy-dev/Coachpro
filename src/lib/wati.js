/**
 * Wati WhatsApp API helper
 * Sends messages via Wati's REST API
 */

const WATI_TOKEN = import.meta.env.VITE_WATI_API_TOKEN
const WATI_ENDPOINT = import.meta.env.VITE_WATI_API_ENDPOINT

/**
 * Send a WhatsApp message via Wati
 * @param {string} phone - Phone number with country code (e.g. 919876543210)
 * @param {string} message - Message text
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendWhatsAppMessage(phone, message, config = null) {
  const token = config?.wati_api_token || WATI_TOKEN
  const endpoint = config?.wati_api_endpoint || WATI_ENDPOINT

  if (!token || !endpoint) {
    console.warn('Wati API not configured.')
    return { success: false, error: 'Wati API not configured' }
  }

  // Normalize phone number
  const normalizedPhone = phone.replace(/[^0-9]/g, '')
  const phoneWithCC = normalizedPhone.startsWith('91')
    ? normalizedPhone
    : `91${normalizedPhone}`

  try {
    const response = await fetch(
      `${WATI_ENDPOINT}/api/v1/sendSessionMessage/${phoneWithCC}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WATI_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageText: message }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      return { success: false, error: err }
    }

    return { success: true }
  } catch (err) {
    console.error('Wati send error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Build notification messages for common events
 */
export const buildMessage = {
  feeDue: (studentName, amount, dueDate, instituteName) =>
    `🎓 *${instituteName}*\n\nDear ${studentName},\n\nThis is a reminder that your fee payment of *₹${amount}* is due on *${dueDate}*.\n\nPlease make the payment on time to avoid any inconvenience.\n\n_CoachPro - Institute Management_`,

  feePaid: (studentName, amount, receiptNo, instituteName) =>
    `✅ *${instituteName}*\n\nDear ${studentName},\n\nYour fee payment of *₹${amount}* has been received successfully.\n\nReceipt No: *${receiptNo}*\nThank you!\n\n_CoachPro - Institute Management_`,

  classCancelled: (studentName, batchName, date, reason, instituteName) =>
    `❌ *${instituteName}*\n\nDear ${studentName},\n\nYour class *${batchName}* on *${date}* has been *cancelled*.\n\nReason: ${reason}\n\nSorry for the inconvenience.\n\n_CoachPro - Institute Management_`,

  extraClass: (studentName, batchName, date, time, instituteName) =>
    `📚 *${instituteName}*\n\nDear ${studentName},\n\nAn *extra class* for *${batchName}* has been scheduled.\n\nDate: *${date}*\nTime: *${time}*\n\nPlease make sure to attend.\n\n_CoachPro - Institute Management_`,

  absent: (studentName, batchName, date, parentName, instituteName) =>
    `⚠️ *${instituteName}*\n\nDear ${parentName},\n\n*${studentName}* was marked *absent* in *${batchName}* on *${date}*.\n\nIf this is an error, please contact the institute.\n\n_CoachPro - Institute Management_`,

  examAlert: (studentName, subject, examDate, totalMarks, instituteName) =>
    `📝 *${instituteName}*\n\nDear ${studentName},\n\nReminder: *${subject}* exam is scheduled on *${examDate}*.\n\nTotal Marks: *${totalMarks}*\n\nBest of luck! 🍀\n\n_CoachPro - Institute Management_`,

  announcement: (studentName, message, instituteName) =>
    `📢 *${instituteName}*\n\nDear ${studentName},\n\n${message}\n\n_CoachPro - Institute Management_`,
}
