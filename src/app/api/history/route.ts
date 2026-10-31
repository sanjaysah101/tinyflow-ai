import { desc } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { analysisHistory, db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const offset = Number(searchParams.get("offset") ?? 0);

  try {
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(analysisHistory)
        .orderBy(desc(analysisHistory.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ id: analysisHistory.id }).from(analysisHistory),
    ]);

    return Response.json({
      history: rows,
      total: totalRows.length,
    });
  } catch (err) {
    console.error("[History] DB error:", err);
    return Response.json({ history: [], total: 0 });
  }
}
