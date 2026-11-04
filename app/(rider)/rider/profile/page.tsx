"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Bike, IdCard, LogOut, Phone, Star } from "lucide-react";
import { useAppStore } from "@/lib/store/AppStore";
import { btn } from "@/components/ui";
import { RiderAvatar, VEHICLE_LABEL } from "@/components/delivery/shared";
import { useRider } from "@/components/rider/RiderShell";
import { cn } from "@/lib/utils";

export default function RiderProfilePage() {
  const rider = useRider();
  const router = useRouter();
  const { orders, logout, currentUser } = useAppStore();
  const mine = orders.filter((o) => o.assignedRider?.id === rider.id);
  const delivered = mine.filter((o) => o.orderStatus === "DELIVERED").length;
  const partial = mine.filter((o) => o.orderStatus === "PARTIALLY_DELIVERED").length;
  const failed = mine.filter((o) => o.orderStatus === "FAILED_DELIVERY").length;
  const total = delivered + partial + failed;

  return (
    <div className="space-y-4">
      <section className="flex flex-col items-center rounded-2xl bg-white p-6 text-center shadow-sm">
        <RiderAvatar name={rider.name} className="size-16 text-lg" />
        <p className="mt-2 text-lg font-bold text-apptext-primary">{rider.name}</p>
        <p className="text-sm text-apptext-secondary">{currentUser?.designation ?? "Delivery rider"}</p>
        <p className="mt-2 flex items-center gap-1 text-sm font-medium text-amber-600">
          <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden /> {total ? Math.round(((delivered + partial) / total) * 100) : 100}% success
        </p>
      </section>

      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          ["Delivered", delivered],
          ["Partial", partial],
          ["Failed", failed],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-white p-3 shadow-sm">
            <dt className="text-xs text-apptext-secondary">{l}</dt>
            <dd className="text-xl font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <ul className="divide-y divide-slate-100 rounded-2xl bg-white text-sm shadow-sm">
        <li className="flex items-center gap-3 px-4 py-3">
          <IdCard className="size-4 text-slate-400" aria-hidden /> {rider.employeeCode}
        </li>
        <li className="flex items-center gap-3 px-4 py-3">
          <Phone className="size-4 text-slate-400" aria-hidden /> {rider.phone}
        </li>
        <li className="flex items-center gap-3 px-4 py-3">
          <Bike className="size-4 text-slate-400" aria-hidden /> {VEHICLE_LABEL[rider.vehicleType]} · {rider.vehiclePlateNo}
        </li>
      </ul>

      <button
        onClick={() => {
          logout();
          router.push("/login");
        }}
        className={cn(btn.secondary, "w-full border-rose-200 py-3 text-rose-600")}
      >
        <LogOut className="size-4" aria-hidden /> Sign out
      </button>
    </div>
  );
}
