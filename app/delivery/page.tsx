"use client";

import React, { useState } from "react";
import { 
  mockOrders, 
  mockDeliveryPersonnel, 
  mockDeliveryZoneRules 
} from "@/lib/db/mock-data";
import { Order, OrderStatus, DeliveryPersonnel, DeliveryZoneRule } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { 
  Truck, 
  MapPin, 
  Navigation, 
  UserCheck, 
  CheckCircle, 
  Clock, 
  Sliders, 
  FileCheck2, 
  ShieldAlert, 
  Phone, 
  DollarSign, 
  Snowflake, 
  Zap, 
  Printer, 
  X,
  ExternalLink,
  Bike
} from "lucide-react";

export default function DeliveryManagementPage() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [riders, setRiders] = useState<DeliveryPersonnel[]>(mockDeliveryPersonnel);
  const [zoneRules, setZoneRules] = useState<DeliveryZoneRule[]>(mockDeliveryZoneRules);
  const [activeTab, setActiveTab] = useState<"DISPATCH" | "RIDERS" | "RULES">("DISPATCH");
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [showChallanModal, setShowChallanModal] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string>("");

  // Statistics
  const onDeliveryCount = orders.filter((o) => o.orderStatus === "OUT_FOR_DELIVERY" || o.orderStatus === "DISPATCHED").length;
  const ridersOnDuty = riders.filter((r) => r.status === "ON_DELIVERY" || r.status === "ON_DUTY").length;
  const totalCashInTransit = riders.reduce((sum, r) => sum + r.cashInHand, 0);

  const handleAssignRider = () => {
    if (!selectedOrder || !selectedRiderId) return;
    const rider = riders.find((r) => r.id === selectedRiderId);
    if (!rider) return;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrder.id
          ? {
              ...o,
              assignedRider: rider,
              orderStatus: "DISPATCHED",
              dispatchedAt: new Date().toISOString(),
              deliveryChallanNumber: o.deliveryChallanNumber || `CHAL-${Date.now().toString().slice(-6)}`,
            }
          : o
      )
    );

    setRiders((prev) =>
      prev.map((r) =>
        r.id === rider.id
          ? { ...r, currentAssignedOrdersCount: r.currentAssignedOrdersCount + 1, status: "ON_DELIVERY" }
          : r
      )
    );

    setShowRiderModal(false);
    setSelectedOrder(null);
  };

  const markDelivered = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              orderStatus: "DELIVERED",
              paymentStatus: "PAID_COD",
              paidAmount: o.grandTotal,
              dueAmount: 0,
              deliveredAt: new Date().toISOString(),
            }
          : o
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-primary sm:text-2xl">
            Delivery & Fleet Logistics Center
          </h1>
          <p className="text-xs text-apptext-secondary">
            GPS route tracking, rider assignments, delivery rule engine & challan generation (SRS §14 & §15)
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex rounded-xl bg-slate-200/70 p-1">
          <button
            onClick={() => setActiveTab("DISPATCH")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === "DISPATCH"
                ? "bg-brand-primary text-white shadow-sm"
                : "text-apptext-secondary hover:text-brand-primary"
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>Active Dispatch Board</span>
          </button>
          <button
            onClick={() => setActiveTab("RIDERS")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === "RIDERS"
                ? "bg-brand-primary text-white shadow-sm"
                : "text-apptext-secondary hover:text-brand-primary"
            }`}
          >
            <Bike className="h-3.5 w-3.5" />
            <span>Delivery Staff ({riders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("RULES")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === "RULES"
                ? "bg-brand-primary text-white shadow-sm"
                : "text-apptext-secondary hover:text-brand-primary"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Delivery Rule Engine</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-apptext-secondary">Out for Delivery</span>
            <div className="rounded-lg bg-brand-light p-2 text-brand-primary">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-brand-primary font-mono">{onDeliveryCount} Orders</p>
          <p className="text-[11px] text-brand-blue font-medium mt-0.5">En route to customer pharmacies</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-apptext-secondary">Riders on Duty</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-brand-green">
              <Bike className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-apptext-primary font-mono">{ridersOnDuty} Active</p>
          <p className="text-[11px] text-brand-green font-medium mt-0.5">Tejgaon & Mirpur hubs covered</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-apptext-secondary">COD Cash in Transit</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-amber-700 font-mono">{formatCurrency(totalCashInTransit)}</p>
          <p className="text-[11px] text-apptext-secondary mt-0.5">Pending daily reconciliation</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-apptext-secondary">Avg. Transit Duration</span>
            <div className="rounded-lg bg-blue-50 p-2 text-brand-blue">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-apptext-primary font-mono">2h 45m</p>
          <p className="text-[11px] text-apptext-secondary mt-0.5">Dhaka Metro Area benchmark</p>
        </div>
      </div>

      {/* TAB 1: ACTIVE DISPATCH BOARD */}
      {activeTab === "DISPATCH" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                Live Order Dispatch & GPS Routing Stream
              </span>
              <span className="text-xs text-apptext-secondary font-medium">
                Showing all ready, dispatched and en-route deliveries
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {orders.map((ord) => {
                const googleMapsUrl = ord.latitude && ord.longitude 
                  ? `https://www.google.com/maps/search/?api=1&query=${ord.latitude},${ord.longitude}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ord.address)}`;

                return (
                  <div key={ord.id} className="p-5 hover:bg-slate-50/60 transition flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Order & Pharmacy Information */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-brand-primary text-sm">
                          {ord.orderNumber}
                        </span>

                        {/* Delivery Type Badge */}
                        {ord.deliveryType === "COLD_CHAIN" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-brand-blue">
                            <Snowflake className="h-3 w-3" />
                            Cold Chain Insulated Box
                          </span>
                        ) : ord.deliveryType === "EXPRESS" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <Zap className="h-3 w-3" />
                            Express 3-Hour Delivery
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            Standard Dispatch
                          </span>
                        )}

                        {/* Status Badge */}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            ord.orderStatus === "DELIVERED"
                              ? "bg-emerald-50 text-brand-green border border-emerald-200"
                              : ord.orderStatus === "OUT_FOR_DELIVERY"
                              ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                              : ord.orderStatus === "DISPATCHED"
                              ? "bg-blue-50 text-brand-primary border border-blue-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ord.orderStatus.replace(/_/g, " ")}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-apptext-primary">
                        {ord.customerName}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-apptext-secondary">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-brand-primary" />
                          {ord.address}
                        </span>
                        {ord.landmark && (
                          <span className="text-[11px] text-brand-blue font-medium">
                            Landmark: {ord.landmark}
                          </span>
                        )}
                        {ord.distanceKm && (
                          <span className="font-mono text-[11px] font-semibold text-slate-500">
                            ~{ord.distanceKm} km from Hub
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400">
                        Delivery Rule Applied: <strong className="text-slate-600">{ord.deliveryRuleName || "Default Zone 1"}</strong>
                      </div>
                    </div>

                    {/* Middle: Assigned Rider Info */}
                    <div className="min-w-[200px] rounded-lg border border-slate-200 bg-surface p-3 text-xs">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Assigned Delivery Rider
                      </p>
                      {ord.assignedRider ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-brand-primary flex items-center gap-1.5">
                            <Bike className="h-3.5 w-3.5 text-brand-blue" />
                            {ord.assignedRider.name}
                          </p>
                          <p className="text-[11px] text-apptext-secondary">
                            {ord.assignedRider.phone}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {ord.assignedRider.vehiclePlateNo}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-amber-700 font-semibold text-[11px]">Unassigned</p>
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setShowRiderModal(true);
                            }}
                            className="mt-1 inline-flex items-center gap-1 rounded bg-brand-primary px-2.5 py-1 text-[11px] font-bold text-white hover:bg-brand-hover"
                          >
                            <UserCheck className="h-3 w-3" />
                            Assign Rider
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right: Amounts & Action Buttons */}
                    <div className="text-right space-y-2 min-w-[180px]">
                      <div>
                        <p className="text-sm font-black text-apptext-primary font-mono">
                          {formatCurrency(ord.grandTotal)}
                        </p>
                        <p className="text-[10px] text-apptext-secondary">
                          COD Payment: <strong className="text-slate-700">{ord.paymentStatus}</strong>
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        {/* Google Maps GPS Link */}
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-2 text-xs font-semibold text-brand-primary hover:bg-slate-50 transition"
                          title="Open GPS Navigation in Google Maps"
                        >
                          <Navigation className="h-3.5 w-3.5 text-brand-blue" />
                          <span className="hidden sm:inline">GPS Map</span>
                        </a>

                        {/* Delivery Challan Button */}
                        <button
                          onClick={() => {
                            setSelectedOrder(ord);
                            setShowChallanModal(true);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          title="View Delivery Challan"
                        >
                          <FileCheck2 className="h-3.5 w-3.5 text-brand-primary" />
                          <span className="hidden sm:inline">Challan</span>
                        </button>

                        {/* Mark Delivered Button */}
                        {ord.orderStatus !== "DELIVERED" && (
                          <button
                            onClick={() => markDelivered(ord.id)}
                            className="flex items-center gap-1 rounded-lg bg-brand-green px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 transition"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Delivered</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DELIVERY PERSONNEL & FLEET */}
      {activeTab === "RIDERS" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {riders.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand-primary font-bold">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-brand-primary">{r.name}</h3>
                    <p className="text-[11px] font-mono text-slate-400">{r.employeeCode}</p>
                  </div>
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    r.status === "ON_DELIVERY"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-emerald-50 text-brand-green border border-emerald-200"
                  }`}
                >
                  {r.status.replace("_", " ")}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-apptext-secondary">
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-brand-blue" />
                  <span>{r.phone}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-slate-400" />
                  <span>{r.vehicleType} • <strong className="font-mono text-slate-700">{r.vehiclePlateNo}</strong></span>
                </p>
              </div>

              <div className="rounded-lg bg-surface p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Active Parcels in Hand:</span>
                  <span className="font-bold text-brand-primary font-mono">{r.currentAssignedOrdersCount} Deliveries</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash Collected (COD):</span>
                  <span className="font-bold text-amber-700 font-mono">{formatCurrency(r.cashInHand)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => alert(`Reconciled COD cash of ${formatCurrency(r.cashInHand)} with Cash Register!`)}
                  className="w-full rounded-lg bg-slate-100 hover:bg-slate-200 py-2 text-xs font-bold text-apptext-primary transition"
                >
                  Reconcile Cash & Close Shift
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: DELIVERY RULE ENGINE (SRS §14) */}
      {activeTab === "RULES" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-blue/30 bg-brand-light/30 p-4">
            <h3 className="text-xs font-bold text-brand-primary uppercase">
              Configurable Delivery Charge System (SRS Chapter 14)
            </h3>
            <p className="text-[11px] text-apptext-secondary mt-0.5">
              The engine automatically calculates shipping costs based on Customer Area/Zone, Order Total (Free Delivery Threshold), and Special Handling (Cold Chain / Express).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {zoneRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-brand-primary">{rule.zoneName}</h3>
                    <p className="text-[11px] text-apptext-secondary">{rule.district}, {rule.division}</p>
                  </div>
                  <span className="rounded bg-emerald-100 text-brand-green px-2 py-0.5 text-[10px] font-bold">
                    Active
                  </span>
                </div>

                <div className="space-y-2 text-xs border-t border-b border-slate-100 py-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Free Delivery Over:</span>
                    <strong className="text-brand-green font-mono">{formatCurrency(rule.minOrderForFreeDelivery)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Standard Delivery Charge:</span>
                    <strong className="text-slate-800 font-mono">{formatCurrency(rule.standardDeliveryFee)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Express Delivery Charge:</span>
                    <strong className="text-brand-blue font-mono">{formatCurrency(rule.expressDeliveryFee)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transit Window:</span>
                    <strong className="text-slate-700">{rule.estimatedTransitHours}</strong>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Covered Wholesale Territories:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {rule.areasCovered.map((area, aIdx) => (
                      <span
                        key={aIdx}
                        className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RIDER ASSIGNMENT MODAL */}
      {showRiderModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-primary">Assign Delivery Rider</h3>
                <p className="text-xs text-apptext-secondary">Order: {selectedOrder.orderNumber} ({selectedOrder.customerName})</p>
              </div>
              <button onClick={() => setShowRiderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Select Fleet Rider on Duty:
              </label>
              <div className="space-y-2">
                {riders.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                      selectedRiderId === r.id
                        ? "border-brand-primary bg-brand-light/20 ring-1 ring-brand-primary"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="riderChoice"
                        value={r.id}
                        checked={selectedRiderId === r.id}
                        onChange={(e) => setSelectedRiderId(e.target.value)}
                        className="h-4 w-4 text-brand-primary focus:ring-brand-primary"
                      />
                      <div>
                        <p className="text-xs font-bold text-brand-primary">{r.name}</p>
                        <p className="text-[11px] text-apptext-secondary">{r.vehicleType} • {r.vehiclePlateNo}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                      {r.currentAssignedOrdersCount} Active
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowRiderModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                disabled={!selectedRiderId}
                onClick={handleAssignRider}
                className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-white shadow hover:bg-brand-hover disabled:opacity-50"
              >
                Confirm Dispatch & Print Challan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERY CHALLAN MODAL (SRS §36) */}
      {showChallanModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-primary">
                  CONFIDENCE PHARMA • OFFICIAL DELIVERY CHALLAN
                </span>
                <h3 className="text-base font-bold text-brand-primary">
                  Challan #{selectedOrder.deliveryChallanNumber || "CHAL-202611-0089"}
                </h3>
              </div>
              <button onClick={() => setShowChallanModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Challan Metadata */}
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface p-4 text-xs">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase">Customer Consignee:</p>
                <p className="font-bold text-brand-primary">{selectedOrder.customerName}</p>
                <p className="text-apptext-secondary mt-0.5">{selectedOrder.address}</p>
                <p className="text-apptext-secondary">Phone: {selectedOrder.phone}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase">Dispatch Details:</p>
                <p className="font-bold text-slate-800">Order: {selectedOrder.orderNumber}</p>
                <p className="text-apptext-secondary">Rider: {selectedOrder.assignedRider?.name || "Shakil Ahmed"}</p>
                <p className="text-apptext-secondary">Vehicle: {selectedOrder.assignedRider?.vehiclePlateNo || "Dhaka Metro-Ha 45-8891"}</p>
              </div>
            </div>

            {/* Packaged Items */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Delivered Pharmaceutical Goods (Inspection Verified)
              </p>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">Medicine Description</th>
                      <th className="p-2.5">Pack Unit</th>
                      <th className="p-2.5 text-center">Quantity</th>
                      <th className="p-2.5 text-right">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-2.5 font-bold text-apptext-primary">{it.productName}</td>
                        <td className="p-2.5 text-apptext-secondary">{it.packSizeName}</td>
                        <td className="p-2.5 text-center font-bold font-mono">{it.quantity}</td>
                        <td className="p-2.5 text-right font-semibold text-brand-green">Intact & Sealed</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signature & Seal Boxes */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-center text-xs">
              <div>
                <div className="h-14 border-b border-dashed border-slate-300" />
                <p className="mt-2 font-bold text-slate-700">Dispatcher & Rider Signature</p>
                <p className="text-[10px] text-slate-400">Confidence Pharma Central Warehouse</p>
              </div>
              <div>
                <div className="h-14 border-b border-dashed border-slate-300" />
                <p className="mt-2 font-bold text-slate-700">Recipient Pharmacy Seal & Sign</p>
                <p className="text-[10px] text-slate-400">Goods received in sound sealed condition</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => alert(`Printing official A4 Delivery Challan for ${selectedOrder.orderNumber}`)}
                className="flex items-center gap-1.5 rounded-lg border border-brand-primary bg-white px-4 py-2 text-xs font-bold text-brand-primary hover:bg-brand-light/30 transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Official Challan Copy</span>
              </button>
              <button
                onClick={() => setShowChallanModal(false)}
                className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-brand-hover"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

