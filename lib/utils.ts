export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(value);
}

export function daysUntil(date: string) {
  const today = new Date("2026-05-05");
  const target = new Date(date);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
}

export function buildPaymentMessage(
  customer: string,
  invoiceNumber: string,
  amount: number,
  tone: "gentle" | "firm" | "final",
  signOff = "PaidSoon",
  paymentNote = "Payment details are the same as shown on the invoice."
) {
  const opening = {
    gentle: "I hope you are well. Just a quick reminder",
    firm: "I am following up again as the payment is still outstanding",
    final: "This is a final reminder before I review the next steps"
  }[tone];

  const closing = {
    gentle: "No worries if it is already in progress. Could you let me know when payment is expected?",
    firm: "Please could you arrange payment or confirm the payment date today?",
    final: "Please arrange payment as soon as possible or contact me today if there is an issue."
  }[tone];

  return `Hi ${customer},

${opening} about invoice ${invoiceNumber} for ${formatCurrency(amount)}.

${closing}

${paymentNote}

Kind regards,
${signOff}`;
}
