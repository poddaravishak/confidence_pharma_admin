"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Printer, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useAppStore } from "@/lib/store/AppStore";
import {
  DateRange,
  OPEX_CATEGORIES,
  SeriesRow,
  Summary,
  addDays,
  bucketize,
  changePct,
  comparePrevious,
  dhakaDay,
  getSeries,
  rangeLength,
  weekStart,
} from "@/lib/db/analytics-data";
import { cn } from "@/lib/utils";
import { PageHeader, btn } from "@/components/ui";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { ChartCard, Delta, HBarList, KpiCard } from "@/components/analytics/primitives";
import { TimeSeriesChart, labelRows } from "@/components/analytics/charts";
import { DataTable, Column, ExportButton, downloadCsv } from "@/components/analytics/DataTable";
import { SERIES } from "@/components/analytics/theme";
import { compareLabel, monthLabel, pct, rangeLabel, taka, takaCompact } from "@/components/analytics/format";
import { useDateRange, useLiveHistory } from "@/components/analytics/useAnalytics";

/* ------------------------------------------------------------------ */
/* Statement lines                                                     */
/* ------------------------------------------------------------------ */

type LineKind = "line" | "subtotal" | "total" | "heading";

interface StatementLine {
  id: string;
  label: string;
  kind: LineKind;
  /** Sign shown in the statement: costs are subtracted. */
  sign?: 1 | -1;
  value?: (s: Summary) => number;
  /** For costs, a rise is bad. */
  upIsGood?: boolean;
  indent?: boolean;
}

const LINES: StatementLine[] = [
  { id: "gross", label: "Gross sales", kind: "line", value: (s) => s.grossSales },
  { id: "returns", label: "Less: returns and credit notes", kind: "line", sign: -1, value: (s) => s.returnsValue, upIsGood: false, indent: true },
  { id: "net", label: "Net sales", kind: "subtotal", value: (s) => s.revenue },
  { id: "cogs", label: "Cost of goods sold (weighted average)", kind: "line", sign: -1, value: (s) => s.cogs, upIsGood: false },
  { id: "gp", label: "Gross profit", kind: "subtotal", value: (s) => s.grossProfit },
  { id: "opex-h", label: "Operating expenses", kind: "heading" },
  ...OPEX_CATEGORIES.map(
    (o): StatementLine => ({ id: `opex-${o.id}`, label: o.label, kind: "line", sign: -1, value: (s) => s.opex[o.id], upIsGood: false, indent: true })
  ),
  { id: "opex", label: "Total operating expenses", kind: "subtotal", sign: -1, value: (s) => s.opexTotal, upIsGood: false },
  { id: "salaries", label: "Salaries and wages", kind: "line", sign: -1, value: (s) => s.salaries, upIsGood: false },
  { id: "damage", label: "Damage and expiry write-offs", kind: "line", sign: -1, value: (s) => s.damageLoss, upIsGood: false },
  { id: "expenses", label: "Total expenses", kind: "subtotal", sign: -1, value: (s) => s.totalExpenses, upIsGood: false },
  { id: "netprofit", label: "Net profit", kind: "total", value: (s) => s.netProfit },
];

const signed = (line: StatementLine, v: number) => (line.sign === -1 ? `(${taka(v)})` : taka(v));

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/** The six calendar months ending with the month of `to`. */
function monthWindow(to: string): Pick<DateRange, "from" | "to"> {
  const y = +to.slice(0, 4);
  const m = +to.slice(5, 7) - 1;
  const start = new Date(Date.UTC(y, m - 5, 1)).toISOString().slice(0, 10);
  return { from: start, to };
}

export default function ProfitLossPage() {
  const { can, creditNotes, settings } = useAppStore();
  const history = useLiveHistory();
  const [range, setRange] = useDateRange("mtd");
  const canExport = can("accounts", "export");

  const cmp = useMemo(() => comparePrevious(range, history), [range, history]);
  const s = cmp.period;
  const p = cmp.prior;

  const months = useMemo(() => {
    const rows = bucketize(getSeries(monthWindow(range.to), history), "month");
    return labelRows(rows, "month");
  }, [history, range]);

  const marginWindow = useMemo(() => {
    const len = rangeLength(range);
    return len >= 56 ? range : { from: weekStart(addDays(range.to, -55)), to: range.to };
  }, [range]);
  const marginRows = useMemo(() => {
    const gran = rangeLength(marginWindow) > 200 ? "month" : "week";
    return labelRows(bucketize(getSeries(marginWindow, history), gran), gran);
  }, [history, marginWindow]);

  const periodNotes = useMemo(
    () => creditNotes.filter((c) => {
      const d = dhakaDay(c.createdAt);
      return d >= range.from && d <= range.to;
    }),
    [creditNotes, range]
  );

  const expenseItems = useMemo(() => {
    const list = [
      ...OPEX_CATEGORIES.map((o) => ({ id: o.id, label: o.label, value: s.opex[o.id] })),
      { id: "salaries", label: "Salaries and wages", value: s.salaries },
      { id: "damage", label: "Damage and expiry write-offs", value: s.damageLoss },
    ].sort((a, b) => b.value - a.value);
    return list.map((e) => ({
      id: e.id,
      label: e.label,
      value: e.value,
      display: takaCompact(e.value),
      sub: pct(s.totalExpenses ? (e.value / s.totalExpenses) * 100 : 0, 0),
    }));
  }, [s]);

  const monthColumns: Column<SeriesRow & { label: string }>[] = [
    { key: "month", label: "Month", value: (r) => r.key, render: (r) => `${monthLabel(r.key, true)}${r.incomplete ? " *" : ""}` },
    { key: "revenue", label: "Net sales", align: "right", value: (r) => Math.round(r.revenue), render: (r) => taka(r.revenue) },
    { key: "grossProfit", label: "Gross profit", align: "right", value: (r) => Math.round(r.grossProfit), render: (r) => taka(r.grossProfit) },
    { key: "margin", label: "Gross margin", align: "right", value: (r) => Number(r.margin.toFixed(1)), render: (r) => pct(r.margin), hideOnMobile: true },
    { key: "totalExpenses", label: "Expenses", align: "right", value: (r) => Math.round(r.totalExpenses), render: (r) => taka(r.totalExpenses), hideOnMobile: true },
    {
      key: "netProfit",
      label: "Net profit",
      align: "right",
      value: (r) => Math.round(r.netProfit),
      render: (r) => <span className={r.netProfit < 0 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>{taka(r.netProfit)}</span>,
    },
    { key: "netMargin", label: "Net margin", align: "right", value: (r) => Number(r.netMargin.toFixed(1)), render: (r) => pct(r.netMargin), hideOnMobile: true },
  ];

  const exportStatement = () =>
    downloadCsv(
      `profit_and_loss_${range.from}_to_${range.to}`,
      ["Line item", `This period (${range.from} to ${range.to})`, "% of net sales", `Previous period (${cmp.prevRange.from} to ${cmp.prevRange.to})`, "Change %"],
      LINES.filter((l) => l.value).map((l) => {
        const v = l.value!(s);
        const pv = l.value!(p);
        const ch = cmp.comparable ? changePct(v, pv) : null;
        return [l.label, Math.round(v * (l.sign ?? 1)), s.revenue ? Number(((v / s.revenue) * 100).toFixed(2)) : 0, Math.round(pv * (l.sign ?? 1)), ch === null ? "" : Number(ch.toFixed(1))];
      })
    );

  return (
    <div className="space-y-6">
      <style>{`@media print { .pl-print { padding: 16px; } .pl-print .pl-chart { break-inside: avoid; } }`}</style>
      <PageHeader
        breadcrumb={
          <Link href="/accounts" className="hover:text-brand-primary">
            Accounts
          </Link>
        }
        title="Profit and loss"
        description="Management P&L on a weighted-average cost basis. Expenses are accrued daily from the monthly budget."
        actions={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            {canExport && <ExportButton onClick={exportStatement} label="Export statement" />}
            <button type="button" onClick={() => window.print()} className={btn.secondary}>
              <Printer className="size-4" aria-hidden />
              Print
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Net sales" icon={TrendingUp} value={takaCompact(s.revenue)} delta={cmp.change("revenue")} compareLabel={compareLabel(range)} />
        <KpiCard label="Gross profit" icon={Scale} value={takaCompact(s.grossProfit)} hint={`${pct(s.margin)} margin`} delta={cmp.change("grossProfit")} />
        <KpiCard label="Total expenses" icon={Wallet} value={takaCompact(s.totalExpenses)} delta={cmp.change("totalExpenses")} upIsGood={false} compareLabel={compareLabel(range)} />
        <KpiCard
          label="Net profit"
          icon={s.netProfit < 0 ? TrendingDown : TrendingUp}
          value={<span className={s.netProfit < 0 ? "text-rose-700" : undefined}>{takaCompact(s.netProfit)}</span>}
          hint={`${pct(s.netMargin)} net margin`}
          delta={cmp.change("netProfit")}
        />
      </div>

      <div className="print-area pl-print space-y-6">
        <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
            <div>
              <p className="text-xs font-medium text-apptext-secondary">{settings.company.legalName}</p>
              <h2 className="text-base font-semibold text-apptext-primary">Profit and loss statement</h2>
              <p className="text-sm text-apptext-secondary">
                {rangeLabel(range)}
                {cmp.range.to === cmp.range.from ? "" : ` · ${rangeLength(range)} days`}
              </p>
            </div>
            <p className="text-xs text-apptext-secondary">
              Compared with {rangeLabel(cmp.prevRange)}
              {!cmp.comparable && " (outside history)"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Profit and loss for {rangeLabel(range)}</caption>
              <thead className="bg-surface text-xs text-apptext-secondary">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-medium sm:px-5">
                    Line item
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    This period
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    % of net sales
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Previous
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium sm:px-5">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {LINES.map((l) => {
                  if (l.kind === "heading")
                    return (
                      <tr key={l.id}>
                        <th scope="row" colSpan={5} className="px-4 pb-1 pt-4 text-left text-xs font-semibold uppercase tracking-wide text-apptext-secondary sm:px-5">
                          {l.label}
                        </th>
                      </tr>
                    );
                  const v = l.value!(s);
                  const pv = l.value!(p);
                  const isTotal = l.kind === "total";
                  const isSub = l.kind === "subtotal";
                  return (
                    <tr
                      key={l.id}
                      className={cn(
                        isSub && "border-t border-slate-200 font-semibold",
                        isTotal && "border-t-2 border-slate-300 bg-surface/70 text-base font-bold",
                        !isSub && !isTotal && "text-apptext-primary"
                      )}
                    >
                      <th scope="row" className={cn("px-4 py-2 text-left font-[inherit] sm:px-5", l.indent && "pl-8 font-normal text-apptext-secondary sm:pl-9")}>
                        {l.label}
                      </th>
                      <td className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums", isTotal && (v < 0 ? "text-rose-700" : "text-emerald-700"))}>
                        {signed(l, v)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-apptext-secondary">
                        {s.revenue ? pct((v / s.revenue) * 100) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-apptext-secondary">{signed(l, pv)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right sm:px-5">
                        <Delta value={cmp.comparable ? changePct(v, pv) : null} upIsGood={l.upIsGood ?? true} className="justify-end" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-apptext-secondary sm:px-5">
            Returns include partial and failed deliveries and customer RMAs.
            {periodNotes.length > 0 &&
              ` ${periodNotes.length} credit ${periodNotes.length === 1 ? "note" : "notes"} worth ${taka(periodNotes.reduce((n, c) => n + c.amount, 0))} issued in this period.`}{" "}
            Figures are demo data.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard className="pl-chart" title="Monthly performance" description="Net sales, COGS and gross profit · last six months, current month to date">
            <TimeSeriesChart
              data={months}
              series={[
                { key: "revenue", label: "Net sales", color: SERIES.revenue, kind: "bar" },
                { key: "cogs", label: "COGS", color: SERIES.cogs, kind: "bar" },
                { key: "grossProfit", label: "Gross profit", color: SERIES.profit, kind: "bar" },
              ]}
              height={260}
              label="Monthly net sales, COGS and gross profit"
              footer={(r) => `Gross margin ${pct(Number(r.margin ?? 0))}`}
            />
          </ChartCard>
          <ChartCard className="pl-chart" title="Net profit by month" description="After operating expenses, salaries and write-offs">
            <TimeSeriesChart
              data={months}
              series={[
                { key: "netProfit", label: "Net profit", color: SERIES.profit, kind: "bar", colorFor: (v) => (v < 0 ? SERIES.loss : SERIES.profit) },
              ]}
              height={260}
              label="Monthly net profit"
              zeroLine
              footer={(r) => `Net margin ${pct(Number(r.netMargin ?? 0))}`}
            />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard className="pl-chart" title="Margin trend" description={`Gross and net margin · ${rangeLabel(marginWindow)}`}>
            <TimeSeriesChart
              data={marginRows}
              series={[
                { key: "margin", label: "Gross margin", color: SERIES.profit, kind: "line" },
                { key: "netMargin", label: "Net margin", color: SERIES.revenue, kind: "line" },
              ]}
              height={240}
              label="Gross and net margin over time"
              yFormat={(v) => `${v}%`}
              valueFormat={(v) => pct(v)}
              zeroLine
            />
          </ChartCard>
          <ChartCard className="pl-chart" title="Expense breakdown" description={`${taka(s.totalExpenses)} in the period · share of total`}>
            <HBarList items={expenseItems} color={SERIES.cogs} />
          </ChartCard>
        </div>

        <ChartCard title="Monthly P&L" description="* month still open">
          <DataTable
            caption="Monthly profit and loss"
            columns={monthColumns}
            rows={months}
            rowKey={(r) => r.key}
            initialSort={{ key: "month", dir: "desc" }}
            exportName={canExport ? `monthly_pnl_${months[0]?.key ?? ""}_to_${months[months.length - 1]?.key ?? ""}` : undefined}
            canExport={canExport}
          />
        </ChartCard>
      </div>
    </div>
  );
}
