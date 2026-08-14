const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const CREDIT_TYPES = new Set(['credit', 'in', 'incoming', 'income', 'receive', 'received']);
const DEBIT_TYPES = new Set(['debit', 'out', 'outgoing', 'expense', 'withdraw', 'withdrawal']);

export const resolveTransactionDirection = (tx) => {
  const direction = String(
    pickFirst(tx?.type, tx?.direction, tx?.flow, tx?.transactionDirection) || '',
  ).toLowerCase();

  if (DEBIT_TYPES.has(direction)) return 'debit';
  if (CREDIT_TYPES.has(direction)) return 'credit';

  const amount = toNumber(
    pickFirst(tx?.amountUsd, tx?.amountUSD, tx?.amount_usd, tx?.amount, tx?.usdAmount, tx?.value, 0),
  );
  return amount < 0 ? 'debit' : 'credit';
};

export const resolveTransactionAmount = (tx, { formatMoney } = {}) => {
  const rawAmount = pickFirst(
    tx?.amountUsd,
    tx?.amountUSD,
    tx?.amount_usd,
    tx?.amount,
    tx?.usdAmount,
    tx?.value,
    0,
  );
  const amountNumber = Math.abs(toNumber(rawAmount));
  const direction = resolveTransactionDirection(tx);
  const sign = direction === 'debit' ? '-' : '+';
  const currency = String(pickFirst(tx?.currency, 'USD')).toUpperCase();

  const formatted = formatMoney
    ? `${sign}${formatMoney(amountNumber)}`
    : currency === 'USD'
      ? `${sign}$${amountNumber.toFixed(2)}`
      : `${sign}${amountNumber.toFixed(2)}`;

  return {
    direction,
    amountTone: direction === 'debit' ? 'negative' : 'positive',
    formatted,
  };
};
