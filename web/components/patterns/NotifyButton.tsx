"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/stores/toast";

export function NotifyButton({ feature }: { feature: string }) {
  return (
    <Button
      variant="accent"
      onClick={() =>
        toast(
          "You're on the list",
          `We'll let you know the moment ${feature} goes live.`,
          "success",
        )
      }
    >
      <Bell className="h-4 w-4" />
      Notify me when it&apos;s live
    </Button>
  );
}
