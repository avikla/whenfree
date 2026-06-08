const SENDER_EMAIL = 'no-reply@whenfree.org';
const SENDER_NAME  = 'WhenFree';
const ALERT_EMAIL  = 'avi.klayman@gmail.com';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { to_email, event_name, meeting_url, subject, body, html_body } = data;

    const payload = {
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to_email }],
      subject: subject || `Your meeting link: ${event_name}`,
      textContent: body || `Hi,\n\nHere is your meeting link:\n${meeting_url}\n\nSee you there!`,
    };

    if (html_body) payload.htmlContent = html_body;

    const apiKey = PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY');
    const response = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'api-key': apiKey, 'accept': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    const body_text = response.getContentText();

    if (code < 200 || code >= 300) {
      GmailApp.sendEmail(
        ALERT_EMAIL,
        `WhenFree · Brevo send failed (HTTP ${code})`,
        `A transactional email failed to send via Brevo.\n\nTo: ${to_email}\nSubject: ${subject}\n\nBrevo response:\n${body_text}`
      );
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: `Brevo HTTP ${code}`, detail: body_text }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const result = JSON.parse(body_text);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, messageId: result.messageId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    GmailApp.sendEmail(
      ALERT_EMAIL,
      'WhenFree · Mailer script error',
      `The mailer script threw an unexpected error:\n\n${err.message}\n\nStack:\n${err.stack}`
    );
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
