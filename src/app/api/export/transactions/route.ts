import Papa from "papaparse";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const type = url.searchParams.get("type");
    const customer = url.searchParams.get("customer");
    const paymentTag = url.searchParams.get("paymentTag");
    const game = url.searchParams.get("game");

    let query = supabase.from("transactions").select("*").order("occurred_at", { ascending: false });
    if (from) query = query.gte("occurred_at", new Date(from).toISOString());
    if (to) query = query.lte("occurred_at", new Date(to).toISOString());
    if (type === "income" || type === "cashout") query = query.eq("type", type);
    if (customer) query = query.ilike("customer_name", `%${customer}%`);
    if (paymentTag) query = query.ilike("payment_tag_used", `%${paymentTag}%`);
    if (game) query = query.ilike("game_played", `%${game}%`);

    const [txRes, profilesRes] = await Promise.all([
      query,
      supabase.from("profiles").select("id,full_name"),
    ]);

    if (txRes.error) throw txRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));

    const rows = (txRes.data ?? []).map((tx) => ({
      occurred_at: tx.occurred_at,
      worker: profileMap[tx.user_id] ?? tx.user_id,
      type: tx.type,
      customer_name: tx.customer_name,
      amount_received: tx.amount_received,
      amount_cashed_out: tx.amount_cashed_out,
      payment_tag_used: tx.payment_tag_used ?? "",
      game_played: tx.game_played ?? "",
      redeemed: tx.redeemed,
      notes: tx.notes ?? "",
    }));

    const csv = Papa.unparse(rows);
    const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed." },
      { status: 500 },
    );
  }
}


