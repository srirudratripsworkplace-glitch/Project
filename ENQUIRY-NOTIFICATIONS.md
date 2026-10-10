# Enquiry notifications setup

Enquiry submissions are saved to the existing PostgreSQL `enquiries` table before notification delivery is attempted. The API returns the saved enquiry ID and separate email/WhatsApp notification statuses. Notification failures do not undo a saved enquiry.

## Server environment

Configure these values in `.env.local` for local development or in the API host's server-side environment. Keep them out of source control; do not put them in `VITE_*` variables or frontend code.

### Email via SMTP

Configure all of the following to enable email notifications:

- `SMTP_HOST`: SMTP hostname provided by your email provider.
- `SMTP_PORT`: SMTP port (commonly 465 for implicit TLS or 587 for STARTTLS).
- `SMTP_USER` and `SMTP_PASS`: provider-issued SMTP login credentials or app password.
- `ENQUIRY_FROM_EMAIL`: sender address authorized by the provider.
- `ENQUIRY_TO_EMAIL`: Srirudra Trips business inbox that should receive enquiries (defaults to `srirudratrips@gmail.com`).

Email notifications remain disabled unless all SMTP settings, including a valid recipient, are configured. Use a provider-issued SMTP credential; never use a personal account password.

### WhatsApp Business Platform Cloud API

Configure all of the following to enable WhatsApp notifications:

- `WHATSAPP_ACCESS_TOKEN`: server-side Meta Cloud API access token.
- `WHATSAPP_PHONE_NUMBER_ID`: sender phone-number ID from the WhatsApp Business Platform.
- `WHATSAPP_BUSINESS_NUMBER`: business number that should receive the notification, in international format (defaults to `447405958896`).
- `WHATSAPP_TEMPLATE_NAME`: approved template name available to that WhatsApp Business Account.
- `WHATSAPP_API_VERSION`: a Graph API version currently supported for your Meta app.

The configured approved template must use English (`en`) and contain nine body placeholders in this order: customer name, customer phone, customer email, destination, travel date, traveller count, message, submission timestamp, enquiry ID. Configure and approve a matching template in Meta before enabling these settings. The API result `accepted` means Meta accepted the message request; it is not a delivery receipt.

All enquiry forms also open a prefilled WhatsApp message to the configured business number after the enquiry is saved. The server-side email and WhatsApp notifications use the recipient defaults above, but still require valid SMTP credentials and a configured WhatsApp Business Cloud API sender/template. If either notification service is not fully configured, that service stays disabled while enquiry saving and the other configured service continue to work. Notification failures do not undo an enquiry saved to PostgreSQL. Restart the Node.js API after changing its environment.

## Local testing

Run `npm run start:api` and `npm run dev` in separate terminals. Submit each enquiry form and confirm the success status, the stored enquiry in the Admin Page, and the matching notification status in the `POST /api/enquiries` response. The API must be connected to the configured PostgreSQL database for this test.

Do not use production SMTP or WhatsApp credentials for test submissions. Use an isolated test inbox/provider account or leave notification settings unset; automated tests mock delivery and do not send real notifications.
