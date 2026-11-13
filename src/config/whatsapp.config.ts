import { registerAs } from '@nestjs/config';

const apiBaseUrl =
  process.env.WHATSAPP_API_BASE_URL ??
  process.env.WHATSAPP_API_URL ??
  'https://graph.facebook.com';

const apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v21.0';

export default registerAs('whatsapp', () => ({
  apiBaseUrl,
  apiVersion,
  apiUrl: `${apiBaseUrl.replace(/\/+$/, '')}/${apiVersion.replace(/^\/+/, '')}`,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  token: process.env.WHATSAPP_ACCESS_TOKEN ?? process.env.WHATSAPP_TOKEN,
  verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN,
  appSecret: process.env.WHATSAPP_APP_SECRET,
}));
