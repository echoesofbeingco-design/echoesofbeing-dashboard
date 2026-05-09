import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="min-h-screen">
        <Sidebar />
        {/* pt-14 on mobile to avoid overlap with the fixed hamburger button */}
        <div className="pt-14 lg:pt-0 lg:pl-64">
          <main className="min-h-screen">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
