export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let { apiKey, from, to, subject, html } = req.body;

  // Fallback to secure system environment variables if not passed by the client
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    apiKey = process.env.SYSTEM_RESEND_API_KEY;
  }
  if (!from || from === 'undefined' || from === 'null') {
    from = process.env.SYSTEM_RESEND_SENDER || 'noreply@coachpro.nrtechworks.online';
  }

  // Defensive fallback: If email configuration is missing, log to console instead of throwing error
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || !from || from === 'undefined' || from === 'null') {
    console.warn('--- EMAIL LOG FALLBACK ---');
    console.warn(`To: ${to}`);
    console.warn(`Subject: ${subject}`);
    console.warn(`Content: ${html}`);
    console.warn('--------------------------');
    return res.status(200).json({ 
      success: true, 
      warning: 'Email logged to server console because Resend API key or Sender email is not configured.',
      id: 'log-fallback'
    });
  }

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required parameters (to, subject, html)' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy email error:', error);
    return res.status(500).json({ error: error.message });
  }
}
