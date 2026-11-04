import { SettingsNav } from "@/components/settings/shared";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-brand-primary">Settings</h1>
        <p className="mt-1 text-pretty text-sm text-apptext-secondary">
          Company details, staff access, tax and invoicing, payments, delivery, returns and notifications.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[232px_minmax(0,1fr)] lg:items-start">
        <SettingsNav />
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </div>
  );
}
