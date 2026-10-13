// src/services/notificationService.js — Automated Email Attendance Alerts
// Supports:
//   📧 Nodemailer (Gmail, Office365, Amazon SES, SendGrid, Custom SMTP)
//   🧪 Graceful Simulation Mode when SMTP credentials are not configured

const nodemailer = require('nodemailer');
const { query }  = require('../config/db');

// ── Email Transporter Initialization ──────────────────────────────────────────
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
  }

  // No SMTP credentials configured -> return null (simulation mode)
  return null;
}

const transporter = createTransporter();

/**
 * Send an email alert to a single recipient
 */
async function sendEmail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || '"FaceVoxAI Academic System" <alerts@facevoxai.edu>';

  if (transporter) {
    try {
      const info = await transporter.sendMail({ from, to, subject, text, html });
      return { success: true, channel: 'email', messageId: info.messageId, simulated: false };
    } catch (err) {
      console.error(`[NotificationService] Email delivery to ${to} failed:`, err.message);
      return { success: false, channel: 'email', error: err.message, simulated: false };
    }
  }

  // Simulation mode (logs to server console)
  console.log(`[SIMULATED EMAIL] To: ${to} | Subject: ${subject}`);
  return { success: true, channel: 'email', simulated: true, note: 'Simulated mode (configure SMTP_HOST, SMTP_USER, SMTP_PASS in .env for live sending)' };
}

/**
 * Generate formatted responsive HTML email template for student absence
 */
function buildAbsenceEmailHtml({ studentName, rollNumber, subjectName, subjectCode, date, time }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); padding: 24px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 22px; color: #fbbf24;">🛡️ FaceVoxAI Attendance Notice</h2>
        <p style="margin: 6px 0 0; font-size: 13px; color: #c7d2fe;">Automated Institutional Absence Alert</p>
      </div>
      <div style="padding: 24px 28px; color: #334155;">
        <p style="font-size: 15px; margin-top: 0;">Dear <strong>${studentName}</strong> (Roll No: <code>${rollNumber}</code>),</p>
        <p style="font-size: 14px; line-height: 1.6;">
          You were marked <span style="background: #fee2e2; color: #ef4444; padding: 2px 8px; border-radius: 4px; font-weight: bold;">ABSENT</span> for the following academic lecture session:
        </p>

        <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px;">
          <tr style="background: #f8fafc;">
            <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; width: 35%;">Subject</td>
            <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">${subjectName} (${subjectCode})</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600;">Date</td>
            <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">${date}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600;">Time</td>
            <td style="padding: 10px 14px; border: 1px solid #e2e8f0;">${time}</td>
          </tr>
        </table>

        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 18px 0; font-size: 13px; color: #92400e;">
          ⚠️ <strong>Attendance Policy Reminder:</strong> Maintaining a minimum of <strong>75% attendance</strong> is mandatory for university examination eligibility.
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          If you believe this record is an error or you were verified in person, please contact your subject instructor immediately.
        </p>
      </div>
      <div style="background: #f1f5f9; padding: 14px 24px; text-align: center; font-size: 11px; color: #64748b;">
        FaceVoxAI v2.0 · Automated Biometric & Attendance Platform
      </div>
    </div>
  `;
}

/**
 * Dispatch absence emails for an entire completed session
 */
async function sendSessionAbsenceAlerts(sessionId) {
  // Query absent students for this session
  const { rows: absentStudents } = await query(
    `SELECT a.student_id, s.name, s.roll_number, s.email,
            sub.name AS subject_name, sub.code AS subject_code,
            cs.session_date, cs.start_time
     FROM attendance a
     JOIN students s        ON s.id   = a.student_id
     JOIN class_sessions cs ON cs.id  = a.session_id
     JOIN subjects sub      ON sub.id = a.subject_id
     WHERE a.session_id = $1 AND a.status = 'absent'`,
    [sessionId]
  );

  if (!absentStudents.length) {
    return {
      sessionId,
      totalAbsent: 0,
      emailsSent: 0,
      message: 'No absent students in this session.',
    };
  }

  let emailsSent = 0;
  const dispatchResults = [];

  for (const st of absentStudents) {
    const dateFormatted = st.session_date ? new Date(st.session_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today';
    const timeFormatted = st.start_time || 'Class Session';

    let emailRes = null;

    if (st.email) {
      const subject = `⚠️ Absence Notice: ${st.subject_code} - ${dateFormatted}`;
      const html = buildAbsenceEmailHtml({
        studentName: st.name,
        rollNumber: st.roll_number,
        subjectName: st.subject_name,
        subjectCode: st.subject_code,
        date: dateFormatted,
        time: timeFormatted,
      });
      const text = `Dear ${st.name} (Roll No: ${st.roll_number}), you were marked ABSENT for ${st.subject_name} (${st.subject_code}) on ${dateFormatted}. Please maintain >=75% attendance.`;

      emailRes = await sendEmail({ to: st.email, subject, html, text });
      if (emailRes.success) emailsSent++;
    }

    dispatchResults.push({
      studentId: st.student_id,
      name: st.name,
      rollNumber: st.roll_number,
      email: st.email,
      emailResult: emailRes,
    });
  }

  return {
    sessionId,
    totalAbsent: absentStudents.length,
    emailsSent,
    isSimulated: !transporter,
    results: dispatchResults,
  };
}

module.exports = {
  sendEmail,
  sendSessionAbsenceAlerts,
};
