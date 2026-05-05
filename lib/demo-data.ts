import type { Customer, Invoice } from "./types";

export const customers: Customer[] = [
  {
    id: "customer-1",
    name: "Acme Studio Ltd",
    contact: "Sarah Collins",
    email: "accounts@acmestudio.co.uk",
    notes: "Friendly client, usually pays after one reminder."
  },
  {
    id: "customer-2",
    name: "Northside Dental",
    contact: "Mark Evans",
    email: "mark@northsidedental.co.uk",
    notes: "Prefers email. Payment terms are 14 days."
  }
];

export const invoices: Invoice[] = [
  {
    id: "invoice-1",
    customer: "Acme Studio Ltd",
    invoiceNumber: "INV-1007",
    amount: 1250,
    status: "overdue",
    dueDate: "2026-04-30",
    notes: "Website maintenance retainer. Needs a gentle reminder."
  },
  {
    id: "invoice-2",
    customer: "Northside Dental",
    invoiceNumber: "INV-1008",
    amount: 640,
    status: "sent",
    dueDate: "2026-05-08",
    notes: "Social media content package."
  },
  {
    id: "invoice-3",
    customer: "Bright Clean Co",
    invoiceNumber: "INV-1009",
    amount: 380,
    status: "paid",
    dueDate: "2026-05-01",
    notes: "Paid after first reminder."
  }
];
