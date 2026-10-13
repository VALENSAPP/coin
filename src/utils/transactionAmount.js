const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const CREDIT_TYPES = new Set(['credit', 'in', 'incoming', 'income', 'receive', 'received']);
const DEBIT_TYPES = new Set(['debit', 'out', 'outgoing', 'expense', 'withdraw', 'withdrawal']);

export const resolveTransactionDirection = (tx) => {
  const explicit = String(
    pickFirst(tx?.direction, tx?.flow, tx?.transactionDirection) || '',
  ).toLowerCase();

  if (DEBIT_TYPES.has(explicit) || explicit === 'sent' || explicit === 'debit') return 'debit';
  if (CREDIT_TYPES.has(explicit) || explicit === 'received' || explicit === 'credit') return 'credit';

  const type = String(pickFirst(tx?.type) || '').toLowerCase();
  if (DEBIT_TYPES.has(type)) return 'debit';
  if (CREDIT_TYPES.has(type)) return 'credit';

  const amount = toNumber(
    pickFirst(tx?.amountUsd, tx?.amountUSD, tx?.amount_usd, tx?.amount, tx?.usdAmount, tx?.value, 0),
  );
  return amount < 0 ? 'debit' : 'credit';
};

export const resolveTransactionType = (tx) => {
  const typeField = tx?.type;
  const typeIsDirection = ['credit', 'debit'].includes(String(typeField || '').toLowerCase());
  const raw = pickFirst(
    tx?.typeTransaction,
    tx?.action,
    tx?.forPayment,
    typeIsDirection ? '' : typeField,
    tx?.transactionType,
    tx?.category,
    tx?.source,
    '',
  );
  const lowered = String(raw || '').trim().toLowerCase();
  if (lowered === 'payfollowing' || lowered === 'following' || lowered.includes('follow')) return 'payFollowing';
  if (lowered === 'tip') return 'tip';
  if (lowered === 'donation' || lowered === 'missiondonation' || lowered.includes('donation') || lowered.includes('mission')) return 'donation';
  if (lowered === 'shopebook' || lowered === 'ebook' || lowered.includes('shopebook')) return 'shopEbook';
  if (lowered === 'marketplace' || lowered.includes('marketplace')) return 'marketplace';
  return lowered;
};

export const resolveTransactionAmount = (tx, { formatMoney } = {}) => {
  const direction = resolveTransactionDirection(tx);
  const normType = resolveTransactionType(tx);

  let rawAmount;
  let sign = direction === 'debit' ? '-' : '+';

  if (
    normType === 'payFollowing' ||
    normType === 'donation' ||
    normType === 'shopEbook' ||
    normType === 'marketplace'
  ) {
    if (direction === 'credit') {
      rawAmount = pickFirst(
        tx?.amount,
        tx?.amountUsd,
        tx?.amountUSD,
        tx?.amount_usd,
        0,
      );
      sign = '+';
    } else {
      rawAmount = pickFirst(
        tx?.totalAmount,
        tx?.total,
        tx?.totalAmountUsd,
        tx?.totalAmountUSD,
        tx?.amountUsd,
        tx?.amount,
        0,
      );
      sign = '-';
    }
  } else if (normType === 'tip') {
    if (direction === 'debit') {
      rawAmount = pickFirst(
        tx?.totalAmount,
        tx?.total,
        tx?.totalAmountUsd,
        tx?.totalAmountUSD,
        tx?.amountUsd,
        tx?.amount,
        0,
      );
      sign = '-';
    } else {
      rawAmount = pickFirst(
        tx?.totalAmount,
        tx?.total,
        tx?.totalAmountUsd,
        tx?.totalAmountUSD,
        tx?.amountUsd,
        tx?.amount,
        0,
      );
      sign = '+';
    }
  } else {
    rawAmount = pickFirst(
      tx?.amountUsd,
      tx?.amountUSD,
      tx?.amount_usd,
      tx?.amount,
      tx?.usdAmount,
      tx?.value,
      0,
    );
  }

  const amountNumber = Math.abs(toNumber(rawAmount));
  const currency = String(pickFirst(tx?.currency, 'USD')).toUpperCase();

  const formatted = formatMoney
    ? `${sign}${formatMoney(amountNumber)}`
    : currency === 'USD'
      ? `${sign}$${amountNumber.toFixed(2)}`
      : `${sign}${amountNumber.toFixed(2)}`;

  return {
    direction,
    amountTone: sign === '-' ? 'negative' : 'positive',
    formatted,
    amountNumber,
    sign,
  };
};
