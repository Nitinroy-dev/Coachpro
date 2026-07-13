/**
 * Wati WhatsApp API helper (Wati integration removed for lightweight production)
 */

/**
 * Send a WhatsApp message via Wati (Disabled - returns success without network requests)
 * @param {string} phone - Phone number
 * @param {string} message - Message text
 * @returns {Promise<{success: boolean}>}
 */
export async function sendWhatsAppMessage(phone, message, config = null) {
  console.info(`[WhatsApp Notification Logged] Phone: ${phone} | Message: ${message}`);
  return { success: true };
}

/**
 * Build notification messages for common events
 */
export const buildMessage = {
  feeDue: (studentName, amount, dueDate, instituteName) =>
    `🎓 *${instituteName}*\n\nDear ${studentName},\n\nThis is a reminder that your fee payment of *₹${amount}* is due on *${dueDate}*.\n\nPlease make the payment on time to avoid any inconvenience.\n\n_Batch Desk - Institute Management_`,

  feePaid: (studentName, amount, receiptNo, instituteName) =>
    `✅ *${instituteName}*\n\nDear ${studentName},\n\nYour fee payment of *₹${amount}* has been received successfully.\n\nReceipt No: *${receiptNo}*\nThank you!\n\n_Batch Desk - Institute Management_`,

  classCancelled: (studentName, batchName, date, reason, instituteName) =>
    `❌ *${instituteName}*\n\nDear ${studentName},\n\nYour class *${batchName}* on *${date}* has been *cancelled*.\n\nReason: ${reason}\n\nSorry for the inconvenience.\n\n_Batch Desk - Institute Management_`,

  extraClass: (studentName, batchName, date, time, instituteName) =>
    `📚 *${instituteName}*\n\nDear ${studentName},\n\nAn *extra class* for *${batchName}* has been scheduled.\n\nDate: *${date}*\nTime: *${time}*\n\nPlease make sure to attend.\n\n_Batch Desk - Institute Management_`,

  absent: (studentName, batchName, date, parentName, instituteName) =>
    `⚠️ *${instituteName}*\n\nDear ${parentName},\n\n*${studentName}* was marked *absent* in *${batchName}* on *${date}*.\n\nIf this is an error, please contact the institute.\n\n_Batch Desk - Institute Management_`,

  examAlert: (studentName, subject, examDate, totalMarks, instituteName) =>
    `📝 *${instituteName}*\n\nDear ${studentName},\n\nReminder: *${subject}* exam is scheduled on *${examDate}*.\n\nTotal Marks: *${totalMarks}*\n\nBest of luck! 🍀\n\n_Batch Desk - Institute Management_`,

  announcement: (studentName, message, instituteName) =>
    `📢 *${instituteName}*\n\nDear ${studentName},\n\n${message}\n\n_Batch Desk - Institute Management_`,
}
