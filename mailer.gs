const SENDER_EMAIL = 'no-reply@whenfree.org';
const SENDER_NAME  = 'WhenFree';
const ALERT_EMAIL  = 'avi.klayman@gmail.com';


function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { to_email, event_name, meeting_url, subject, body, html_body } = data;

    const apiKey = PropertiesService.getScriptProperties().getProperty('ZEPTO_API_KEY').trim();
    const response = UrlFetchApp.fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': apiKey,
        'Accept': 'application/json'
      },
      payload: JSON.stringify({
        from: { address: SENDER_EMAIL, name: SENDER_NAME },
        to: [{ email_address: { address: to_email } }],
        subject: subject || `Your meeting link: ${event_name}`,
        htmlbody: html_body || `<p>Hi,</p><p>Here is your meeting link: <a href="${meeting_url}">${meeting_url}</a></p>`,
        textbody: body || `Hi,\n\nHere is your meeting link:\n${meeting_url}`,
      }),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    const body_text = response.getContentText();

    if (code < 200 || code >= 300) {
      GmailApp.sendEmail(
        ALERT_EMAIL,
        `WhenFree · ZeptoMail send failed (HTTP ${code})`,
        `A transactional email failed to send via ZeptoMail.\n\nTo: ${to_email}\nSubject: ${subject}\n\nZeptoMail response:\n${body_text}`
      );
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: `ZeptoMail HTTP ${code}`, detail: body_text }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const result = JSON.parse(body_text);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, messageId: result.request_id }))
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
