import {
  CircleDollarSign,
  ClipboardList,
  Coins,
  Clapperboard,
  Film,
  ReceiptText,
  Settings,
  Shield,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import type { SidebarData } from "@/components/dashboard/types";
import { webConfig } from "@/configs/web-config";

const creditsEnabled = webConfig.creditsEnabled;
const administrationItems: SidebarData["navGroups"][number]["items"] = [];

if (webConfig.adminUserManagementEnabled) {
  administrationItems.push({
    title: "dashboard.nav.users",
    url: "/users",
    icon: ShieldCheck,
    permission: { resource: "user", action: "list" },
  });
}

if (webConfig.adminPaidUsersEnabled) {
  administrationItems.push({
    title: "dashboard.nav.paidUsers",
    url: "/admin/paid-users",
    icon: CircleDollarSign,
    permission: { resource: "admin", action: "access" },
  });
}

if (webConfig.adminUserManagementEnabled) {
  administrationItems.push({
    title: "dashboard.nav.adminOperations",
    url: "/admin/operations",
    icon: ClipboardList,
    permission: { resource: "operation", action: "list" },
  });
}

export const sidebarData: SidebarData = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "",
  },
  navGroups: [
    {
      title: "dashboard.nav.history",
      items: [
        {
          title: "video.studio.history.title",
          url: "/works",
          icon: Film,
        },
      ],
    },
    {
      title: "dashboard.nav.general",
      items: [
        {
          title: "video.nav.studio",
          url: "/studio",
          icon: Clapperboard,
        },
      ],
    },
    {
      title: "dashboard.nav.administration",
      items: administrationItems,
    },
    ...(creditsEnabled
      ? [
          {
            title: "dashboard.nav.credits",
            items: [
              {
                title: "dashboard.nav.creditPurchase",
                url: "/credits/purchase",
                icon: Coins,
              },
              {
                title: "dashboard.nav.creditTransactions",
                url: "/credits/transactions",
                icon: ReceiptText,
              },
            ],
          },
        ]
      : []),
    {
      title: "dashboard.nav.other",
      items: [
        {
          title: "dashboard.nav.settings",
          icon: Settings,
          defaultOpen: true,
          items: [
            {
              title: "dashboard.nav.profile",
              url: "/settings/profile",
              icon: UserCog,
            },
            {
              title: "dashboard.nav.security",
              url: "/settings/security",
              icon: Shield,
            },
          ],
        },
      ],
    },
  ],
};
