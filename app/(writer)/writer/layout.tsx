import { DashboardLayout } from "@/components/shared/dashboard-layout";

export default function WriterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
