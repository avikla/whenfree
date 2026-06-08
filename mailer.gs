const SENDER_EMAIL = 'no-reply@whenfree.org';
const SENDER_NAME  = 'WhenFree';

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
    });

    const result = JSON.parse(response.getContentText());

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, messageId: result.messageId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
