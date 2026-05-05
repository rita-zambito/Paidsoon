export type InvoiceStatus = "draft" | "sent" | "overdue" | "paid";

export type Customer = {
  id: string;
  name: string;
  contact: string;
  email: string;
  notes: string;
};

export type Invoice = {
  id: string;
  customer: string;
  invoiceNumber: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  notes: string;
};

export type BusinessSettings = {
  businessName: string;
  senderName: string;
  email: string;
  phone: string;
  paymentTerms: string;
  paymentNote: string;
  signOff: string;
};
