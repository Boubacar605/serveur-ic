import { registerAs } from '@nestjs/config';

export default registerAs('commission', () => ({
  percent: Number(process.env.COMMISSION_PERCENT ?? 0),
  maxDebt: Number(process.env.MAX_COMMISSION_DEBT ?? 5000),
}));
