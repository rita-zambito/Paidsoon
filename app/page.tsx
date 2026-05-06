"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { BusinessSettings, Customer, Invoice, InvoiceStatus } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { buildPaymentMessage, daysUntil, formatCurrency, formatDate } from "@/lib/utils";

type View = "dashboard" | "invoices" | "customers" | "messages" | "settings";
type AuthMode = "sign-in" | "sign-up";

type CustomerRow = {
  id: string;
  user_id: string;
  name: string;
  contact: string | null;
  email: string | null;
  notes: string | null;
};

type InvoiceRow = {
  id: string;
  user_id: string;
  customer_id: string | null;
  customer_name: string;
  invoice_number: string;
  amount: number | string;
  status: InvoiceStatus;
  due_date: string;
  notes: string | null;
};

type BusinessSettingsRow = {
  user_id: string;
  business_name: string | null;
  sender_name: string | null;
  email: string | null;
  phone: string | null;
  payment_terms: string | null;
  payment_note: string | null;
  sign_off: string | null;
};

const navItems: Array<{ id: View; label: string }> = [
  { id: "dashboard", label: "Overview" },
  { id: "invoices", label: "Invoices" },
  { id: "customers", label: "Customers" },
  { id: "messages", label: "Chase messages" },
  { id: "settings", label: "Settings" }
];

const defaultSettings: BusinessSettings = {
  businessName: "",
  senderName: "",
  email: "",
  phone: "",
  paymentTerms: "Payment is due according to the terms shown on the invoice.",
  paymentNote: "Payment details are the same as shown on the invoice.",
  signOff: ""
};

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [message, setMessage] = useState("Choose an invoice or fill in the form to generate a polite payment chase message.");
  const [settings, setSettings] = useState<BusinessSettings>(defaultSettings);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | InvoiceStatus>("all");
  const [selectedMessageInvoiceId, setSelectedMessageInvoiceId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [aiNotice, setAiNotice] = useState("");

  const user = session?.user ?? null;
  const overdueInvoices = invoices.filter((invoice) => invoice.status === "overdue");
  const filteredInvoices = invoiceFilter === "all"
    ? invoices
    : invoices.filter((invoice) => invoice.status === invoiceFilter);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      setNotice("Supabase is not configured yet.");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setCustomers([]);
      setInvoices([]);
      return;
    }

    loadData(user.id);
  }, [user]);

  const metrics = useMemo(() => {
    const outstanding = invoices.filter((invoice) => invoice.status !== "paid");
    const overdue = invoices.filter((invoice) => invoice.status === "overdue");
    const dueThisWeek = outstanding.filter((invoice) => {
      const days = daysUntil(invoice.dueDate);
      return days >= 0 && days <= 7;
    });
    const paid = invoices.filter((invoice) => invoice.status === "paid");

    return {
      outstanding: outstanding.reduce((total, invoice) => total + invoice.amount, 0),
      overdue: overdue.length,
      dueThisWeek: dueThisWeek.reduce((total, invoice) => total + invoice.amount, 0),
      paid: paid.reduce((total, invoice) => total + invoice.amount, 0)
    };
  }, [invoices]);

  async function loadData(userId: string) {
    if (!supabase) {
      return;
    }

    setIsLoading(true);
    const [customersResult, invoicesResult, settingsResult] = await Promise.all([
      supabase.from("customers").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("business_settings").select("*").eq("user_id", userId).maybeSingle()
    ]);

    if (customersResult.error || invoicesResult.error || settingsResult.error) {
      setNotice(customersResult.error?.message || invoicesResult.error?.message || settingsResult.error?.message || "Could not load data.");
      setIsLoading(false);
      return;
    }

    setCustomers((customersResult.data as CustomerRow[]).map(customerFromRow));
    setInvoices((invoicesResult.data as InvoiceRow[]).map(invoiceFromRow));
    setSettings(settingsResult.data ? settingsFromRow(settingsResult.data as BusinessSettingsRow) : defaultSettings);
    setIsLoading(false);
  }

  async function loadDemoData() {
    if (!supabase || !user) {
      return;
    }

    const demoCustomers: Array<Omit<Customer, "id">> = [
      {
        name: "Green Lane Bakery",
        contact: "Sarah Collins",
        email: "sarah@greenlanebakery.co.uk",
        notes: "Friendly bakery in London. Usually pays after a reminder."
      },
      {
        name: "Bright Tap Plumbing",
        contact: "James Miller",
        email: "accounts@brighttap.co.uk",
        notes: "Small plumbing business. Prefers short and direct emails."
      },
      {
        name: "North & Co Salon",
        contact: "Amelia Hughes",
        email: "hello@northcosalon.co.uk",
        notes: "Independent salon. Keep the tone warm and polite."
      },
      {
        name: "Oakfield Design Studio",
        contact: "Daniel Reed",
        email: "daniel@oakfieldstudio.co.uk",
        notes: "Design studio with multiple invoices open."
      }
    ];

    const existingDemoNames = new Set(customers.map((customer) => customer.name.toLowerCase()));
    const customersToCreate = demoCustomers.filter((customer) => !existingDemoNames.has(customer.name.toLowerCase()));

    const createdCustomers = customersToCreate.length
      ? await supabase
        .from("customers")
        .insert(customersToCreate.map((customer) => ({
          user_id: user.id,
          name: customer.name,
          contact: customer.contact,
          email: customer.email,
          notes: customer.notes
        })))
        .select()
      : { data: [], error: null };

    if (createdCustomers.error) {
      setNotice(createdCustomers.error.message);
      return;
    }

    const nextCustomers = [
      ...customers,
      ...((createdCustomers.data || []) as CustomerRow[]).map(customerFromRow)
    ];
    const customerIdByName = new Map(nextCustomers.map((customer) => [customer.name.toLowerCase(), customer.id]));
    const existingInvoiceNumbers = new Set(invoices.map((invoice) => invoice.invoiceNumber.toLowerCase()));
    const demoInvoices: Array<Omit<Invoice, "id">> = [
      {
        customer: "Green Lane Bakery",
        invoiceNumber: "INV-1001",
        amount: 850,
        status: "overdue",
        dueDate: "2026-04-25",
        notes: "Website updates and monthly maintenance."
      },
      {
        customer: "Bright Tap Plumbing",
        invoiceNumber: "INV-1002",
        amount: 1260,
        status: "sent",
        dueDate: "2026-05-09",
        notes: "Lead capture page and booking form."
      },
      {
        customer: "North & Co Salon",
        invoiceNumber: "INV-1003",
        amount: 390,
        status: "paid",
        dueDate: "2026-05-01",
        notes: "Social media graphics package."
      },
      {
        customer: "Oakfield Design Studio",
        invoiceNumber: "INV-1004",
        amount: 1850,
        status: "overdue",
        dueDate: "2026-04-18",
        notes: "Landing page build and conversion copy."
      },
      {
        customer: "Oakfield Design Studio",
        invoiceNumber: "INV-1005",
        amount: 640,
        status: "sent",
        dueDate: "2026-05-12",
        notes: "Extra design revisions."
      }
    ];
    const invoicesToCreate = demoInvoices.filter((invoice) => !existingInvoiceNumbers.has(invoice.invoiceNumber.toLowerCase()));

    if (!customersToCreate.length && !invoicesToCreate.length) {
      setNotice("Demo data is already loaded.");
      window.setTimeout(() => setNotice(""), 1800);
      return;
    }

    const createdInvoices = invoicesToCreate.length
      ? await supabase
        .from("invoices")
        .insert(invoicesToCreate.map((invoice) => invoiceToInsert(
          invoice,
          user.id,
          customerIdByName.get(invoice.customer.toLowerCase())
        )))
        .select()
      : { data: [], error: null };

    if (createdInvoices.error) {
      setNotice(createdInvoices.error.message);
      return;
    }

    setCustomers(nextCustomers);
    setInvoices((current) => [
      ...((createdInvoices.data || []) as InvoiceRow[]).map(invoiceFromRow),
      ...current
    ]);
    setNotice("Demo customers and invoices loaded.");
    window.setTimeout(() => setNotice(""), 1800);
  }

  async function addInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const dueDate = String(formData.get("dueDate"));
    const invoice: Omit<Invoice, "id"> = {
      customer: String(formData.get("customer")),
      invoiceNumber: String(formData.get("invoiceNumber")),
      amount: Number(formData.get("amount")),
      status: daysUntil(dueDate) < 0 ? "overdue" : "sent",
      dueDate,
      notes: String(formData.get("notes") || "")
    };

    const { data, error } = await supabase
      .from("invoices")
      .insert(invoiceToInsert(invoice, user.id, findCustomerId(customers, invoice.customer)))
      .select()
      .single();

    if (error) {
      setNotice(error.message);
      return;
    }

    setInvoices((current) => [invoiceFromRow(data as InvoiceRow), ...current]);
    event.currentTarget.reset();
    setView("invoices");
  }

  async function editInvoice(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!supabase || !user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const invoice: Omit<Invoice, "id"> = {
      customer: String(formData.get("customer")),
      invoiceNumber: String(formData.get("invoiceNumber")),
      amount: Number(formData.get("amount")),
      status: String(formData.get("status")) as InvoiceStatus,
      dueDate: String(formData.get("dueDate")),
      notes: String(formData.get("notes") || "")
    };

    const { data, error } = await supabase
      .from("invoices")
      .update(invoiceToInsert(invoice, user.id, findCustomerId(customers, invoice.customer)))
      .eq("id", id)
      .select()
      .single();

    if (error) {
      setNotice(error.message);
      return;
    }

    setInvoices((current) => current.map((item) => item.id === id ? invoiceFromRow(data as InvoiceRow) : item));
    setEditingInvoiceId(null);
  }

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const customer: Omit<Customer, "id"> = {
      name: String(formData.get("name")),
      contact: String(formData.get("contact") || ""),
      email: String(formData.get("email") || ""),
      notes: String(formData.get("notes") || "")
    };

    const { data, error } = await supabase
      .from("customers")
      .insert({ ...customer, user_id: user.id })
      .select()
      .single();

    if (error) {
      setNotice(error.message);
      return;
    }

    setCustomers((current) => [customerFromRow(data as CustomerRow), ...current]);
    event.currentTarget.reset();
  }

  async function editCustomer(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!supabase || !user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const customer: Omit<Customer, "id"> = {
      name: String(formData.get("name")),
      contact: String(formData.get("contact") || ""),
      email: String(formData.get("email") || ""),
      notes: String(formData.get("notes") || "")
    };

    const { data, error } = await supabase
      .from("customers")
      .update(customer)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      setNotice(error.message);
      return;
    }

    setCustomers((current) => current.map((item) => item.id === id ? customerFromRow(data as CustomerRow) : item));
    setEditingCustomerId(null);
  }

  async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("invoices").update({ status }).eq("id", id);

    if (error) {
      setNotice(error.message);
      return;
    }

    setInvoices((current) => current.map((invoice) => (invoice.id === id ? { ...invoice, status } : invoice)));
  }

  async function deleteInvoice(id: string) {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("invoices").delete().eq("id", id);

    if (error) {
      setNotice(error.message);
      return;
    }

    setInvoices((current) => current.filter((invoice) => invoice.id !== id));
  }

  async function deleteCustomer(id: string) {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      setNotice(error.message);
      return;
    }

    setCustomers((current) => current.filter((customer) => customer.id !== id));
  }

  function generateFromInvoice(invoice: Invoice) {
    setSelectedMessageInvoiceId(invoice.id);
    setAiNotice("");
    setMessage(`Ready to write a payment reminder for ${invoice.invoiceNumber}.`);
    setView("messages");
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const nextSettings: BusinessSettings = {
      businessName: String(formData.get("businessName") || ""),
      senderName: String(formData.get("senderName") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      paymentTerms: String(formData.get("paymentTerms") || ""),
      paymentNote: String(formData.get("paymentNote") || ""),
      signOff: String(formData.get("signOff") || "")
    };

    const { error } = await supabase
      .from("business_settings")
      .upsert(settingsToRow(nextSettings, user.id));

    if (error) {
      setNotice(error.message);
      return;
    }

    setSettings(nextSettings);
    setNotice("Settings saved.");
    window.setTimeout(() => setNotice(""), 1600);
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopyNotice("Message copied.");
    window.setTimeout(() => setCopyNotice(""), 1600);
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">PS</span>
          <div>
            <strong>PaidSoon</strong>
            <span>Payment chasing for small business</span>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              className={`navButton ${view === item.id ? "navButtonActive" : ""}`}
              key={item.id}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebarNote">
          <strong>{user.email}</strong>
          <p>Get paid faster without awkward chasing.</p>
          <button className="navButton" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Payment control</p>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <button className="primaryButton" onClick={() => setView("invoices")}>New invoice</button>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {view === "dashboard" && (
          <>
            <section className="heroPanel">
              <div>
                <p className="eyebrow">Today</p>
                <h2>{overdueInvoices.length ? `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? "s" : ""} need chasing` : "No overdue invoices today"}</h2>
                <p>PaidSoon keeps a simple payment list for small businesses that want fewer awkward money conversations.</p>
              </div>
              <div className="heroActions">
                <button className="primaryButton" onClick={() => setView("messages")}>Write chase message</button>
                <button className="secondaryButton" onClick={loadDemoData}>Load demo data</button>
              </div>
            </section>

            <section className="metrics">
              <Metric label="Money outstanding" value={formatCurrency(metrics.outstanding)} />
              <Metric label="Overdue invoices" value={String(metrics.overdue)} />
              <Metric label="Due this week" value={formatCurrency(metrics.dueThisWeek)} />
              <Metric label="Paid this month" value={formatCurrency(metrics.paid)} />
            </section>

            <section className="grid">
              <Panel title="Chase today">
                <div className="list">
                  {overdueInvoices.length ? overdueInvoices.map((invoice) => (
                    <article className="taskRow" key={invoice.id}>
                      <div>
                        <strong>{invoice.customer}</strong>
                        <span>{invoice.invoiceNumber} - {Math.abs(daysUntil(invoice.dueDate))} days overdue</span>
                      </div>
                      <button className="secondaryButton" onClick={() => generateFromInvoice(invoice)}>Write message</button>
                    </article>
                  )) : (
                    <article className="emptyState">Everything is up to date.</article>
                  )}
                </div>
              </Panel>

              <Panel title="Recent invoices">
                <InvoiceList
                  editingInvoiceId={editingInvoiceId}
                  invoices={invoices.slice(0, 3)}
                  onCancelEdit={() => setEditingInvoiceId(null)}
                  onDelete={deleteInvoice}
                  onEdit={editInvoice}
                  onGenerate={generateFromInvoice}
                  onStartEdit={setEditingInvoiceId}
                  onStatus={updateInvoiceStatus}
                />
              </Panel>
            </section>
          </>
        )}

        {view === "invoices" && (
          <section className="grid">
            <Panel title="Add invoice">
              <form className="form" onSubmit={addInvoice}>
                <label>
                  Customer
                  <input name="customer" list="customerNames" required placeholder="Acme Studio Ltd" />
                  <datalist id="customerNames">
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.name} />
                    ))}
                  </datalist>
                </label>
                <label>Invoice number<input name="invoiceNumber" required placeholder="INV-1007" /></label>
                <label>Amount<input name="amount" required type="number" min="0" step="10" placeholder="850" /></label>
                <label>Due date<input name="dueDate" required type="date" /></label>
                <label>Notes<textarea name="notes" rows={3} placeholder="Payment terms 14 days." /></label>
                <button className="primaryButton" type="submit">Create invoice</button>
              </form>
            </Panel>

            <Panel title="Invoices">
              <StatusFilters active={invoiceFilter} onChange={setInvoiceFilter} />
              <InvoiceList
                editingInvoiceId={editingInvoiceId}
                invoices={filteredInvoices}
                onCancelEdit={() => setEditingInvoiceId(null)}
                onDelete={deleteInvoice}
                onEdit={editInvoice}
                onGenerate={generateFromInvoice}
                onStartEdit={setEditingInvoiceId}
                onStatus={updateInvoiceStatus}
              />
            </Panel>
          </section>
        )}

        {view === "customers" && (
          <section className="grid">
            <Panel title="Add customer">
              <form className="form" onSubmit={addCustomer}>
                <label>Business name<input name="name" required placeholder="Acme Studio Ltd" /></label>
                <label>Contact<input name="contact" placeholder="Sarah Collins" /></label>
                <label>Email<input name="email" type="email" placeholder="accounts@acmestudio.co.uk" /></label>
                <label>Notes<textarea name="notes" rows={4} placeholder="Usually pays after one reminder." /></label>
                <button className="primaryButton" type="submit">Save customer</button>
              </form>
            </Panel>

            <Panel title="Customers">
              <div className="list">
                {customers.map((customer) => editingCustomerId === customer.id ? (
                  <CustomerEditForm
                    customer={customer}
                    key={customer.id}
                    onCancel={() => setEditingCustomerId(null)}
                    onSubmit={editCustomer}
                  />
                ) : (
                  <article className="card" key={customer.id}>
                    <h3>{customer.name}</h3>
                    <p>{customer.contact || "No contact"} - {customer.email || "No email"}</p>
                    <p>{customer.notes || "No notes added."}</p>
                    <div className="actions">
                      <button className="secondaryButton" onClick={() => setEditingCustomerId(customer.id)}>Edit</button>
                      <button className="dangerButton" onClick={() => deleteCustomer(customer.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {view === "messages" && (
          <section className="grid">
            <Panel title="Generate message">
              <MessageForm
                invoices={invoices}
                onGenerate={setMessage}
                onNotice={setAiNotice}
                onSelectedInvoiceId={setSelectedMessageInvoiceId}
                selectedInvoiceId={selectedMessageInvoiceId}
                settings={settings}
              />
            </Panel>

            <Panel title="Ready to send">
              {aiNotice && <div className="notice">{aiNotice}</div>}
              <div className="panelActions">
                <button className="secondaryButton" onClick={copyMessage}>Copy message</button>
                {copyNotice && <span>{copyNotice}</span>}
              </div>
              <pre className="messageBox">{message}</pre>
            </Panel>
          </section>
        )}

        {view === "settings" && (
          <section className="grid">
            <Panel title="Business settings">
              <SettingsForm onSubmit={saveSettings} settings={settings} />
            </Panel>

            <Panel title="Message preview">
              <pre className="messageBox">
                {buildPaymentMessage(
                  "Acme Studio Ltd",
                  "INV-1007",
                  850,
                  "gentle",
                  messageSignOff(settings),
                  settings.paymentNote || defaultSettings.paymentNote
                )}
              </pre>
            </Panel>
          </section>
        )}
      </main>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [notice, setNotice] = useState("");
  const isSignUp = mode === "sign-up";

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    if (!supabase) {
      setNotice("Supabase is not configured.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotice(isSignUp ? "Account created. Check your email if Supabase asks for confirmation." : "Signed in.");
  }

  return (
    <main className="publicShell">
      <header className="publicNav">
        <div className="brand publicBrand">
          <span className="brandMark">PS</span>
          <div>
            <strong>PaidSoon</strong>
            <span>Payment chasing for small business</span>
          </div>
        </div>
        <button className="secondaryButton" onClick={() => setMode("sign-in")}>Sign in</button>
      </header>

      <section className="publicHero">
        <div className="publicCopy">
          <p className="eyebrow">For freelancers and small businesses</p>
          <h1>Get paid faster without awkward chasing.</h1>
          <p>
            PaidSoon tracks unpaid invoices, shows what needs chasing today, and writes polite payment reminders you can send in seconds.
          </p>
          <div className="publicStats">
            <span><strong>£1,890</strong> outstanding</span>
            <span><strong>1</strong> overdue invoice</span>
            <span><strong>30 sec</strong> to write a chase</span>
          </div>
        </div>

        <section className="authCard">
          <h2>{isSignUp ? "Create your workspace" : "Welcome back"}</h2>
          <p>{isSignUp ? "Start with a simple invoice tracker and payment chase workspace." : "Sign in to manage customers, invoices, and chase messages."}</p>
          <form className="form" onSubmit={handleAuth}>
            <label>Email<input name="email" required type="email" placeholder="you@example.com" /></label>
            <label>Password<input name="password" required type="password" minLength={6} placeholder="Minimum 6 characters" /></label>
            <button className="primaryButton" type="submit">{isSignUp ? "Create account" : "Sign in"}</button>
          </form>
          {notice && <div className="notice">{notice}</div>}
          <button className="linkButton" onClick={() => setMode(isSignUp ? "sign-in" : "sign-up")}>
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </section>
      </section>

      <section className="publicSections">
        <article>
          <h3>Know who owes you</h3>
          <p>See outstanding, overdue, due-this-week, and paid invoices in one simple dashboard.</p>
        </article>
        <article>
          <h3>Send better reminders</h3>
          <p>Generate gentle, firm, or final payment messages using your own business sign-off.</p>
        </article>
        <article>
          <h3>Built for early users</h3>
          <p>Start simple now. Email sending, Stripe, and automations come next.</p>
        </article>
      </section>

      <section className="pricingBand">
        <div>
          <p className="eyebrow">Early access pricing</p>
          <h2>Start at £9/month for the first users.</h2>
        </div>
        <button className="primaryButton" onClick={() => setMode("sign-up")}>Create account</button>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="authShell">
      <section className="authCard">
        <span className="brandMark">PS</span>
        <h1>Loading PaidSoon</h1>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InvoiceList({
  editingInvoiceId,
  invoices,
  onCancelEdit,
  onDelete,
  onEdit,
  onGenerate,
  onStartEdit,
  onStatus
}: {
  editingInvoiceId: string | null;
  invoices: Invoice[];
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEdit: (event: FormEvent<HTMLFormElement>, id: string) => void;
  onGenerate: (invoice: Invoice) => void;
  onStartEdit: (id: string) => void;
  onStatus: (id: string, status: InvoiceStatus) => void;
}) {
  return (
    <div className="list">
      {invoices.length ? invoices.map((invoice) => editingInvoiceId === invoice.id ? (
        <InvoiceEditForm
          invoice={invoice}
          key={invoice.id}
          onCancel={onCancelEdit}
          onSubmit={onEdit}
        />
      ) : (
        <article className="invoiceCard" key={invoice.id}>
          <div className="invoiceInfo">
            <div className="invoiceTop">
              <h3>{invoice.invoiceNumber}</h3>
              <span className={`status status${capitalize(invoice.status)}`}>{invoice.status}</span>
            </div>
            <p className="invoiceMeta">
              {invoice.customer} - {formatCurrency(invoice.amount)} - due {formatDate(invoice.dueDate)}
            </p>
            <p className="invoiceNotes">{invoice.notes || "No notes added."}</p>
          </div>
          <div className="actions">
            <button className="secondaryButton" onClick={() => onGenerate(invoice)}>Message</button>
            <button className="secondaryButton" onClick={() => onStartEdit(invoice.id)}>Edit</button>
            {invoice.status !== "paid" && (
              <button className="secondaryButton" onClick={() => onStatus(invoice.id, "paid")}>Mark paid</button>
            )}
            <button className="dangerButton" onClick={() => onDelete(invoice.id)}>Delete</button>
          </div>
        </article>
      )) : (
        <article className="emptyState">No invoices found for this view.</article>
      )}
    </div>
  );
}

function StatusFilters({
  active,
  onChange
}: {
  active: "all" | InvoiceStatus;
  onChange: (status: "all" | InvoiceStatus) => void;
}) {
  const filters: Array<{ label: string; value: "all" | InvoiceStatus }> = [
    { label: "All", value: "all" },
    { label: "Draft", value: "draft" },
    { label: "Sent", value: "sent" },
    { label: "Overdue", value: "overdue" },
    { label: "Paid", value: "paid" }
  ];

  return (
    <div className="filterBar">
      {filters.map((filter) => (
        <button
          className={`filterButton ${active === filter.value ? "filterButtonActive" : ""}`}
          key={filter.value}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function InvoiceEditForm({
  invoice,
  onCancel,
  onSubmit
}: {
  invoice: Invoice;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, id: string) => void;
}) {
  return (
    <form className="editForm" onSubmit={(event) => onSubmit(event, invoice.id)}>
      <label>Customer<input name="customer" required defaultValue={invoice.customer} /></label>
      <label>Invoice number<input name="invoiceNumber" required defaultValue={invoice.invoiceNumber} /></label>
      <label>Amount<input name="amount" required type="number" min="0" step="10" defaultValue={invoice.amount} /></label>
      <label>Due date<input name="dueDate" required type="date" defaultValue={invoice.dueDate} /></label>
      <label>
        Status
        <select name="status" defaultValue={invoice.status}>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
      </label>
      <label>Notes<textarea name="notes" rows={3} defaultValue={invoice.notes} /></label>
      <div className="actions">
        <button className="primaryButton" type="submit">Save</button>
        <button className="secondaryButton" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function CustomerEditForm({
  customer,
  onCancel,
  onSubmit
}: {
  customer: Customer;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, id: string) => void;
}) {
  return (
    <form className="editForm" onSubmit={(event) => onSubmit(event, customer.id)}>
      <label>Business name<input name="name" required defaultValue={customer.name} /></label>
      <label>Contact<input name="contact" defaultValue={customer.contact} /></label>
      <label>Email<input name="email" type="email" defaultValue={customer.email} /></label>
      <label>Notes<textarea name="notes" rows={3} defaultValue={customer.notes} /></label>
      <div className="actions">
        <button className="primaryButton" type="submit">Save</button>
        <button className="secondaryButton" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function MessageForm({
  invoices,
  onGenerate,
  onNotice,
  onSelectedInvoiceId,
  selectedInvoiceId,
  settings
}: {
  invoices: Invoice[];
  onGenerate: (message: string) => void;
  onNotice: (notice: string) => void;
  onSelectedInvoiceId: (invoiceId: string) => void;
  selectedInvoiceId: string;
  settings: BusinessSettings;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [customer, setCustomer] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const openInvoices = invoices.filter((invoice) => invoice.status !== "paid");

  useEffect(() => {
    const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId);

    if (!selectedInvoice) {
      return;
    }

    setCustomer(selectedInvoice.customer);
    setInvoiceNumber(selectedInvoice.invoiceNumber);
    setAmount(String(selectedInvoice.amount));
  }, [invoices, selectedInvoiceId]);

  function chooseInvoice(invoiceId: string) {
    onSelectedInvoiceId(invoiceId);

    if (!invoiceId) {
      setCustomer("");
      setInvoiceNumber("");
      setAmount("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    onNotice("");
    const formData = new FormData(event.currentTarget);
    const payload = {
      customer,
      invoiceNumber,
      amount: Number(amount),
      tone: String(formData.get("tone")) as "gentle" | "firm" | "final",
      paymentNote: settings.paymentNote || defaultSettings.paymentNote,
      signOff: messageSignOff(settings),
      businessName: settings.businessName
    };

    const fallback = buildPaymentMessage(
      payload.customer,
      payload.invoiceNumber,
      payload.amount,
      payload.tone,
      payload.signOff,
      payload.paymentNote
    );

    try {
      const response = await fetch("/api/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        onGenerate(fallback);
        onNotice("AI is not configured yet, so PaidSoon used the built-in template.");
        return;
      }

      const data = await response.json() as { message?: string };
      onGenerate(data.message?.trim() || fallback);
      onNotice("AI message generated.");
    } catch {
      onGenerate(fallback);
      onNotice("AI could not be reached, so PaidSoon used the built-in template.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Saved invoice
        <select value={selectedInvoiceId} onChange={(event) => chooseInvoice(event.target.value)}>
          <option value="">Manual message</option>
          {openInvoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.customer} - {invoice.invoiceNumber} - {formatCurrency(invoice.amount)}
            </option>
          ))}
        </select>
      </label>
      <label>Customer<input name="customer" required placeholder="Acme Studio Ltd" value={customer} onChange={(event) => setCustomer(event.target.value)} /></label>
      <label>Invoice number<input name="invoiceNumber" required placeholder="INV-1007" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></label>
      <label>Amount<input name="amount" required type="number" min="0" step="10" placeholder="850" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>
        Tone
        <select name="tone">
          <option value="gentle">Gentle reminder</option>
          <option value="firm">Firm but polite</option>
          <option value="final">Final notice</option>
        </select>
      </label>
      <button className="primaryButton" type="submit">{isGenerating ? "Generating..." : "Generate with AI"}</button>
    </form>
  );
}

function SettingsForm({
  onSubmit,
  settings
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  settings: BusinessSettings;
}) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <label>Business name<input name="businessName" defaultValue={settings.businessName} placeholder="Rita Apps" /></label>
      <label>Your name<input name="senderName" defaultValue={settings.senderName} placeholder="Rita" /></label>
      <label>Email<input name="email" type="email" defaultValue={settings.email} placeholder="hello@example.com" /></label>
      <label>Phone<input name="phone" defaultValue={settings.phone} placeholder="07123 456789" /></label>
      <label>Payment terms<textarea name="paymentTerms" rows={3} defaultValue={settings.paymentTerms} /></label>
      <label>Payment note<textarea name="paymentNote" rows={3} defaultValue={settings.paymentNote} /></label>
      <label>Message sign-off<textarea name="signOff" rows={3} defaultValue={settings.signOff} placeholder={"Rita\nRita Apps"} /></label>
      <button className="primaryButton" type="submit">Save settings</button>
    </form>
  );
}

function customerFromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact || "",
    email: row.email || "",
    notes: row.notes || ""
  };
}

function invoiceFromRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    customer: row.customer_name,
    invoiceNumber: row.invoice_number,
    amount: Number(row.amount),
    status: row.status,
    dueDate: row.due_date,
    notes: row.notes || ""
  };
}

function settingsFromRow(row: BusinessSettingsRow): BusinessSettings {
  return {
    businessName: row.business_name || "",
    senderName: row.sender_name || "",
    email: row.email || "",
    phone: row.phone || "",
    paymentTerms: row.payment_terms || defaultSettings.paymentTerms,
    paymentNote: row.payment_note || defaultSettings.paymentNote,
    signOff: row.sign_off || ""
  };
}

function invoiceToInsert(invoice: Omit<Invoice, "id">, userId: string, customerId?: string | null) {
  return {
    user_id: userId,
    customer_id: customerId || null,
    customer_name: invoice.customer,
    invoice_number: invoice.invoiceNumber,
    amount: invoice.amount,
    status: invoice.status,
    due_date: invoice.dueDate,
    notes: invoice.notes
  };
}

function settingsToRow(settings: BusinessSettings, userId: string) {
  return {
    user_id: userId,
    business_name: settings.businessName,
    sender_name: settings.senderName,
    email: settings.email,
    phone: settings.phone,
    payment_terms: settings.paymentTerms,
    payment_note: settings.paymentNote,
    sign_off: settings.signOff,
    updated_at: new Date().toISOString()
  };
}

function messageSignOff(settings: BusinessSettings) {
  if (settings.signOff.trim()) {
    return settings.signOff.trim();
  }

  return [settings.senderName, settings.businessName].filter(Boolean).join("\n") || "PaidSoon";
}

function findCustomerId(customers: Customer[], name: string) {
  return customers.find((customer) => customer.name.toLowerCase() === name.toLowerCase())?.id || null;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
