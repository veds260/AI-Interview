"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  ClipboardList,
  UserCircle,
  Video,
  PenTool,
  Archive,
  Target,
  History,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Clients", href: "/admin/clients", icon: <Users className="h-5 w-5" /> },
  { label: "Competitors", href: "/admin/competitors", icon: <Target className="h-5 w-5" /> },
  { label: "Questions", href: "/admin/questions", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Interviews", href: "/admin/interviews", icon: <MessageSquare className="h-5 w-5" /> },
  { label: "Extractions", href: "/admin/extractions", icon: <FileText className="h-5 w-5" /> },
  { label: "Writers", href: "/admin/writers", icon: <PenTool className="h-5 w-5" /> },
  { label: "Settings", href: "/admin/settings", icon: <Settings className="h-5 w-5" /> },
];

const clientNavItems: NavItem[] = [
  { label: "Dashboard", href: "/client", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Start Interview", href: "/client/interview/start", icon: <Video className="h-5 w-5" /> },
  { label: "My Interviews", href: "/client/interviews", icon: <History className="h-5 w-5" /> },
  { label: "Profile", href: "/client/profile", icon: <UserCircle className="h-5 w-5" /> },
];

const writerNavItems: NavItem[] = [
  { label: "Dashboard", href: "/writer", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Assignments", href: "/writer/assignments", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Content Bank", href: "/writer/content-bank", icon: <Archive className="h-5 w-5" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  let navItems: NavItem[] = [];
  let title = "Compound Interviewer";

  if (role === "admin") {
    navItems = adminNavItems;
    title = "Admin";
  } else if (role === "client") {
    navItems = clientNavItems;
    title = "Founder Portal";
  } else if (role === "writer") {
    navItems = writerNavItems;
    title = "Writer Dashboard";
  }

  return (
    <div className="flex h-screen w-64 flex-col bg-gray-900 text-white">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-gray-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">C</span>
        </div>
        <span className="font-semibold">{title}</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/admin" && item.href !== "/client" && item.href !== "/writer" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-sm font-medium">
              {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {session?.user?.name || "User"}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {session?.user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
