import { useEffect } from "react";
import { useCartStore } from "@/stores/cartStore";
import { supabase } from "@/integrations/supabase/client";

export function useCartSync() {
  const items = useCartStore((s) => s.items);

  useEffect(() => {
    // Cart sync is handled locally via zustand persist
    // No remote sync needed for now
  }, [items]);
}