"use client";

import React, { useState } from "react";
import { MessageSquare, Send, Image, FileText, CheckCheck, Sparkles } from "lucide-react";

export default function MessagesPage() {
  const [activeChat, setActiveChat] = useState("Labaid Pharma Point (Dhanmondi)");
  const [inputMsg, setInputMsg] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "customer",
      time: "10:15 AM",
      text: "Dr. TC Dey, do you have fresh stock of Meropenem 1g injection in warehouse? A nearby clinic needs 20 vials urgently.",
    },
    {
      id: 2,
      sender: "admin",
      time: "10:20 AM",
      text: "Hello Dr. Rafiqul! We have ordered Meropenem 1g from Healthcare Pharma depot. Expected arrival tomorrow 11 AM. Would you like a pre-booking order?",
    },
    {
      id: 3,
      sender: "customer",
      time: "10:24 AM",
      text: "Yes please, book 20 vials for Labaid Point. Also attached prescription inquiry.",
      hasAttachment: true,
    },
  ]);

  const quickReplies = [
    "Yes, stock is available in our Tejgaon warehouse.",
    "We can dispatch today via Express Delivery.",
    "Prescription verified. Draft order has been prepared.",
    "Pre-booking confirmed with Beximco / Healthcare depot.",
  ];

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputMsg;
    if (!text.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: "admin",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: text,
      },
    ]);
    if (!textToSend) setInputMsg("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-brand-primary sm:text-2xl text-balance">
          Customer Inquiry & In-App Messaging
        </h1>
        <p className="text-xs text-apptext-secondary text-pretty">
          Direct communication with pharmacies, medicine stock inquiries & photo requests (SRS §16)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden min-h-[580px]">
        {/* Chat List */}
        <div className="border-r border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Active Pharmacy Threads
          </p>
          <div
            onClick={() => setActiveChat("Labaid Pharma Point (Dhanmondi)")}
            className={`cursor-pointer rounded-xl p-3 transition ${
              activeChat === "Labaid Pharma Point (Dhanmondi)"
                ? "bg-brand-light/70 border border-brand-light"
                : "hover:bg-surface border border-transparent"
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-brand-primary">
                Labaid Pharma Point
              </h4>
              <span className="text-[10px] text-apptext-secondary">10:24 AM</span>
            </div>
            <p className="text-[11px] text-slate-600 truncate mt-1">
              Yes please, book 20 vials for Labaid Point...
            </p>
          </div>

          <div
            onClick={() => setActiveChat("Popular Diagnostic Center (Mirpur)")}
            className={`cursor-pointer rounded-xl p-3 transition ${
              activeChat === "Popular Diagnostic Center (Mirpur)"
                ? "bg-brand-light/70 border border-brand-light"
                : "hover:bg-surface border border-transparent"
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-brand-primary">
                Popular Diagnostic Center
              </h4>
              <span className="text-[10px] text-apptext-secondary">Yesterday</span>
            </div>
            <p className="text-[11px] text-apptext-secondary truncate mt-1">
              Received Dengue NS1 kits in sound condition. Thank you!
            </p>
          </div>
        </div>

        {/* Chat Canvas */}
        <div className="lg:col-span-2 flex flex-col justify-between p-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-brand-primary">{activeChat}</h3>
              <span className="text-[11px] text-brand-green font-bold flex items-center gap-1">
                <span className="size-2 rounded-full bg-brand-green" />
                Verified Business Customer
              </span>
            </div>
          </div>

          {/* Messages Flow */}
          <div className="flex-1 py-4 space-y-4 overflow-y-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === "admin" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl p-3.5 text-xs ${
                    m.sender === "admin"
                      ? "bg-brand-primary text-white rounded-tr-none shadow-xs"
                      : "bg-surface text-apptext-primary rounded-tl-none border border-slate-200/60"
                  }`}
                >
                  <p>{m.text}</p>
                  {m.hasAttachment && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/20 p-2.5 text-[11px]">
                      <FileText className="size-4" />
                      <span>Doctor_Prescription_Inquiry.jpg</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1 font-mono">
                  {m.time}
                </span>
              </div>
            ))}
          </div>

          {/* Quick Reply Pills */}
          <div className="py-2 flex flex-wrap gap-1.5 border-t border-slate-100">
            {quickReplies.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="rounded-full border border-brand-blue/30 bg-brand-light/30 px-3 py-1 text-[11px] font-semibold text-brand-primary hover:bg-brand-light transition"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type official reply to pharmacy..."
              className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary focus:border-brand-primary focus:outline-none"
            />
            <button
              onClick={() => handleSend()}
              className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-brand-hover transition"
            >
              <Send className="size-3.5 text-brand-light" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
