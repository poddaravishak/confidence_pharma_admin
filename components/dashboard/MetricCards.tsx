"use client";

import React from "react";
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Users, 
  Truck, 
  Clock 
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface MetricCardsProps {
  todaySales: number;
  monthNetProfit: number;
  stockValuation: number;
  customerDue: number;
  supplierPayable: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  todaySales,
  monthNetProfit,
  stockValuation,
  customerDue,
  supplierPayable,
}) => {
  const cards = [
    {
      title: "Today's Gross Sales",
      amount: formatCurrency(todaySales),
      subtitle: "+18.4% from yesterday",
      icon: TrendingUp,
      color: "text-brand-primary",
      bgColor: "bg-brand-light",
      borderColor: "border-brand-blue/30",
    },
    {
      title: "Net Profit (COGS Adj.)",
      amount: formatCurrency(monthNetProfit),
      subtitle: "Weighted avg cost calculated",
      icon: DollarSign,
      color: "text-brand-green",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
    },
    {
      title: "Warehouse Stock Value",
      amount: formatCurrency(stockValuation),
      subtitle: "5 active product lines in stock",
      icon: Package,
      color: "text-brand-blue",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      title: "Customer Outstanding Due",
      amount: formatCurrency(customerDue),
      subtitle: "3 pharmacies with balance",
      icon: Users,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
    },
    {
      title: "Supplier Payables Due",
      amount: formatCurrency(supplierPayable),
      subtitle: "Beximco & Square depots",
      icon: Clock,
      color: "text-rose-600",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`rounded-2xl border ${card.borderColor} bg-white p-4 shadow-xs transition hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-apptext-secondary">{card.title}</span>
              <div className={`rounded-xl p-2.5 ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black tracking-tight text-brand-primary font-mono">
                {card.amount}
              </h3>
              <p className="mt-1 text-[11px] text-apptext-secondary font-medium">{card.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
