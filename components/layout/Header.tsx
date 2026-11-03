"use client";

import React, { useState } from "react";
import { 
  Bell, 
  Search, 
  Globe, 
  AlertTriangle,
  ChevronDown
} from "lucide-react";

interface HeaderProps {
  currentLanguage?: "en" | "bn";
  onLanguageToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentLanguage = "en", 
  onLanguageToggle 
}) => {
  const [lang, setLang] = useState<"en" | "bn">(currentLanguage);

  const toggleLanguage = () => {
    const next = lang === "en" ? "bn" : "en";
    setLang(next);
    if (onLanguageToggle) onLanguageToggle();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur transition-all">
      {/* Search Input */}
      <div className="flex w-96 items-center">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 size-4 text-apptext-secondary" />
          <input
            type="text"
            aria-label="Search catalog and orders"
            placeholder={lang === "en" ? "Search medicines, generic, batches, customers..." : "ওষুধের নাম, জেনেরিক বা ফার্মেসি খুঁজুন..."}
            className="h-10 w-full rounded-xl border border-slate-200 bg-surface pl-9 pr-4 text-xs text-apptext-primary placeholder-apptext-secondary transition focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <button
          onClick={toggleLanguage}
          aria-label="Toggle language between English and Bangla"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-3 py-1.5 text-xs font-bold text-brand-primary transition hover:bg-brand-light/40"
        >
          <Globe className="size-3.5 text-brand-blue" />
          <span>{lang === "en" ? "বাংলা" : "English"}</span>
        </button>

        {/* Expiry / Stock Alert Badge */}
        <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
          <AlertTriangle className="size-3.5 text-amber-600" />
          <span className="tabular-nums">2 Urgent Alerts</span>
        </div>

        {/* Notifications Button */}
        <button 
          aria-label="Notifications" 
          className="relative rounded-xl p-2 text-apptext-secondary hover:bg-surface transition"
        >
          <Bell className="size-5" />
          <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-brand-green ring-2 ring-white" />
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        {/* Current User Pill */}
        <div 
          role="button"
          tabIndex={0}
          aria-label="User Profile Menu"
          className="flex items-center gap-3 rounded-xl p-1.5 pl-2 transition hover:bg-surface cursor-pointer"
        >
          <div className="flex size-8 items-center justify-center rounded-xl bg-brand-primary text-white font-extrabold text-xs shadow-xs">
            TC
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-bold text-apptext-primary leading-tight">Dr. TC Dey</p>
            <p className="text-[11px] font-semibold text-brand-blue leading-tight">Super Admin</p>
          </div>
          <ChevronDown className="size-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
};
