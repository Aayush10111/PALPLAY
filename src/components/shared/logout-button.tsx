"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clearMockUserSession } from "@/lib/mock-auth";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const onLogout = async () => {
    setIsLoading(true);
    clearMockUserSession();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
    setIsLoading(false);
  };

  return (
    <Button disabled={isLoading} onClick={onLogout} size="sm" variant="outline">
      {isLoading ? "Logging out..." : "Logout"}
    </Button>
  );
}


