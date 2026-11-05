"use client";

import React, { useMemo, useState } from "react";
import { Paperclip, Plus, Receipt, Users, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { formatDay } from "@/lib/inventory";
import { useAppStore } from "@/lib/store/AppStore";
import { Badge, btn, Card, CardHeader, FilterPills, inputClass, Modal, PageHeader, StatCard, Tabs } from "@/components/ui";

const CATEGORIES = ["Rent & utilities", "Fuel & vehicle", "Cold-chain supplies", "Packaging", "Office & internet", "Marketing", "Repairs", "Misc"] as const;
type Category = (typeof CATEGORIES)[number];

interface Expense {
  id: string;
  date: string;
  category: Category;
  description: string;
  amount: number;
  paidFrom: "Cash till" | "DBBL bank" | "bKash";
  attachment: boolean;
  status: "APPROVED" | "PENDING";
  by: string;
}

const SEED: Expense[] = [
  { id: "ex-1", date: "2026-11-05", category: "Fuel & vehicle", description: "Octane for 3 bikes + van diesel", amount: 4850, paidFrom: "Cash till", attachment: true, status: "APPROVED", by: "Nayeem Islam" },
  { id: "ex-2", date: "2026-11-05", category: "Cold-chain supplies", description: "Gel ice packs (40 pcs) and 2 insulated boxes", amount: 6200, paidFrom: "bKash", attachment: true, status: "PENDING", by: "Rashed Karim" },
  { id: "ex-3", date: "2026-11-04", category: "Packaging", description: "Cartons, tape, bubble wrap", amount: 3150, paidFrom: "Cash till", attachment: false, status: "APPROVED", by: "Mitu Akter" },
  { id: "ex-4", date: "2026-11-01", category: "Rent & utilities", description: "Tejgaon warehouse rent, November", amount: 85000, paidFrom: "DBBL bank", attachment: true, status: "APPROVED", by: "Nayeem Islam" },
  { id: "ex-5", date: "2026-11-01", category: "Rent & utilities", description: "DESCO electricity (cold room)", amount: 18400, paidFrom: "DBBL bank", attachment: true, status: "APPROVED", by: "Nayeem Islam" },
  { id: "ex-6", date: "2026-11-02", category: "Office & internet", description: "Link3 internet + SMS gateway credit", amount: 7500, paidFrom: "bKash", attachment: false, status: "APPROVED", by: "Nayeem Islam" },
  { id: "ex-7", date: "2026-11-03", category: "Repairs", description: "Van brake pads (Dhaka Metro-Tha 12-4433)", amount: 3600, paidFrom: "Cash till", attachment: true, status: "APPROVED", by: "Jahid Hasan" },
];

const PAYROLL = [
  { name: "Ayesha Siddiqua", role: "Head of Operations", gross: 85000 },
  { name: "Rashed Karim", role: "Inventory Manager", gross: 55000 },
  { name: "Nayeem Islam", role: "Accounts Officer", gross: 42000 },
  { name: "Tanvir Hasan", role: "Senior Sales Executive", gross: 38000 },
  { name: "Jahid Hasan", role: "Dispatch Coordinator", gross: 32000 },
  { name: "Mitu Akter", role: "Store Keeper", gross: 24000 },
  { name: "Sohel Rana", role: "Mirpur Hub Lead", gross: 28000 },
  { name: "Shakil Ahmed", role: "Rider", gross: 18000, allowance: 4500 },
  { name: "Kamal Hossain", role: "Rider", gross: 18000, allowance: 4200 },
  { name: "Mohammad Biplob", role: "Van driver", gross: 22000, allowance: 3800, deduction: 200 },
  { name: "Rubel Mia", role: "Rider", gross: 17000, allowance: 3900 },
];

export default function ExpensesPage() {
  const { can, notify, logAudit, currentUser } = useAppStore();
  const [tab, setTab] = useState<"expenses" | "payroll">("expenses");
  const [items, setItems] = useState<Expense[]>(SEED);
  const [filter, setFilter] = useState<"ALL" | Category>("ALL");
  const [adding, setAdding] = useState(false);

  const total = items.reduce((s, e) => s + e.amount, 0);
  const byCat = useMemo(() => CATEGORIES.map((c) => ({ c, v: items.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v), [items]);
  const payroll = PAYROLL.reduce((s, p) => s + p.gross + (p.allowance ?? 0) - (p.deduction ?? 0), 0);
  const list = items.filter((e) => filter === "ALL" || e.category === filter).sort((a, b) => b.date.localeCompare(a.date));

  const approve = (id: string) => {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, status: "APPROVED" } : e)));
    logAudit("EXPENSE_APPROVED", "ACCOUNTS", `Expense ${id} approved.`);
    notify("Expense approved.");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses & payroll"
        description="Operating expenses and monthly salaries feed the profit & loss statement."
        actions={
          can("accounts", "create") && (
            <button onClick={() => setAdding(true)} className={btn.primary}>
              <Plus className="size-4" aria-hidden /> Add expense
            </button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Expenses this month" value={formatCurrency(total)} hint={`${items.length} entries`} icon={Receipt} tone="rose" />
        <StatCard label="Awaiting approval" value={items.filter((e) => e.status === "PENDING").length} hint="Over ৳5,000 needs approval" icon={Wallet} tone="amber" />
        <StatCard label="Payroll (November)" value={formatCurrency(payroll)} hint={`${PAYROLL.length} staff`} icon={Users} tone="blue" />
        <StatCard label="Largest category" value={byCat[0]?.c ?? "—"} hint={byCat[0] ? formatCurrency(byCat[0].v) : ""} icon={Receipt} tone="slate" />
      </div>

      <Tabs value={tab} onChange={setTab} label="Expense views" tabs={[{ id: "expenses", label: "Expenses", count: items.length }, { id: "payroll", label: "Payroll" }]} />

      {tab === "expenses" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <Card>
            <div className="border-b border-slate-100 p-4">
              <FilterPills value={filter} onChange={setFilter} label="Category" options={[{ id: "ALL", label: "All" }, ...CATEGORIES.map((c) => ({ id: c, label: c }))]} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-surface text-xs text-apptext-secondary">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Description</th>
                    <th className="px-3 py-2.5 font-medium">Paid from</th>
                    <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-apptext-secondary">{formatDay(e.date)}</td>
                      <td className="px-3 py-3">
                        <p className="text-apptext-primary">{e.description}</p>
                        <p className="flex items-center gap-1.5 text-xs text-apptext-secondary">
                          {e.category} · {e.by}
                          {e.attachment && <Paperclip className="size-3" aria-label="Receipt attached" />}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-apptext-secondary">{e.paidFrom}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(e.amount)}</td>
                      <td className="px-5 py-3">
                        {e.status === "APPROVED" ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Approved</Badge>
                        ) : can("accounts", "approve") ? (
                          <button onClick={() => approve(e.id)} className={btn.small}>
                            Approve
                          </button>
                        ) : (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-800">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="By category" />
            <ul className="space-y-3 p-4">
              {byCat.map(({ c, v }) => (
                <li key={c}>
                  <div className="flex justify-between text-sm">
                    <span className="text-apptext-primary">{c}</span>
                    <span className="tabular-nums text-apptext-secondary">{formatCurrency(v)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-primary" style={{ width: `${(v / total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === "payroll" && (
        <Card>
          <CardHeader title="November 2026 payroll" description="Rider allowances cover fuel and mobile; settlement shortages are deducted." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-surface text-xs text-apptext-secondary">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Staff</th>
                  <th className="px-3 py-2.5 text-right font-medium">Basic</th>
                  <th className="px-3 py-2.5 text-right font-medium">Allowance</th>
                  <th className="px-3 py-2.5 text-right font-medium">Deduction</th>
                  <th className="px-5 py-2.5 text-right font-medium">Net pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PAYROLL.map((p) => (
                  <tr key={p.name}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-apptext-primary">{p.name}</p>
                      <p className="text-xs text-apptext-secondary">{p.role}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(p.gross)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{p.allowance ? formatCurrency(p.allowance) : "—"}</td>
                    <td className={cn("px-3 py-3 text-right tabular-nums", p.deduction && "text-rose-600")}>{p.deduction ? `− ${formatCurrency(p.deduction)}` : "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCurrency(p.gross + (p.allowance ?? 0) - (p.deduction ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-surface">
                <tr>
                  <td className="px-5 py-3 font-semibold" colSpan={4}>
                    Total
                  </td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">{formatCurrency(payroll)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {adding && (
        <AddExpenseModal
          onClose={() => setAdding(false)}
          onSave={(e) => {
            const needsApproval = e.amount > 5000 && !can("accounts", "approve");
            setItems((prev) => [{ ...e, id: `ex-${Date.now()}`, status: needsApproval ? "PENDING" : "APPROVED", by: currentUser?.name ?? "Staff" }, ...prev]);
            logAudit("EXPENSE_ADDED", "ACCOUNTS", `${e.category}: ${e.description} ${formatCurrency(e.amount)}.`);
            notify(needsApproval ? "Expense saved and sent for approval." : "Expense saved.");
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function AddExpenseModal({ onClose, onSave }: { onClose: () => void; onSave: (e: Omit<Expense, "id" | "status" | "by">) => void }) {
  const [date, setDate] = useState("2026-11-05");
  const [category, setCategory] = useState<Category>("Fuel & vehicle");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [paidFrom, setPaidFrom] = useState<Expense["paidFrom"]>("Cash till");
  const [attachment, setAttachment] = useState(false);
  const valid = description.trim().length >= 3 && amount > 0;
  return (
    <Modal
      title="Add expense"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button disabled={!valid} onClick={() => onSave({ date, category, description: description.trim(), amount, paidFrom, attachment })} className={btn.primary}>
            Save expense
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Amount (৳)</span>
          <input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value) || 0)} className={cn(inputClass, "tabular-nums")} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Paid from</span>
          <select value={paidFrom} onChange={(e) => setPaidFrom(e.target.value as Expense["paidFrom"])} className={inputClass}>
            <option>Cash till</option>
            <option>DBBL bank</option>
            <option>bKash</option>
          </select>
        </label>
        <button type="button" onClick={() => setAttachment((a) => !a)} className={cn(btn.secondary, "sm:col-span-2")}>
          <Paperclip className="size-4" aria-hidden /> {attachment ? "Receipt attached" : "Attach receipt"}
        </button>
      </div>
    </Modal>
  );
}
