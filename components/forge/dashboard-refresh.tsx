"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardRefresh() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function refreshDashboard() {
    setRefreshing(true);
    setError("");

    try {
      const responses = await Promise.all([
        fetch("/api/me/progress", { cache: "no-store" }),
        fetch("/api/me/recommendations", { cache: "no-store" }),
      ]);

      if (responses.some((response) => !response.ok)) {
        throw new Error("Unable to refresh dashboard data.");
      }

      router.refresh();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh dashboard data.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="inline-flex min-h-11 items-center justify-center border-2 border-black bg-white px-4 py-2 font-extrabold transition-transform hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-60"
        disabled={refreshing}
        onClick={refreshDashboard}
        type="button"
      >
        {refreshing ? "Refreshing…" : "Refresh progress"}
      </button>
      {error ? (
        <span className="text-sm font-bold text-[#b3261e]" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}
