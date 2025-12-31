import { DashboardLayout } from "@/components/shared/dashboard-layout";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
