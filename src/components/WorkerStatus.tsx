"use client";

import { useEffect, useState } from "react";
import { Activity, Power, PauseCircle, AlertTriangle, RefreshCcw } from "lucide-react";

export function WorkerStatus() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch("/api/worker/status");
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error("Status fetch failed", e);
            } finally {
                setLoading(false);
            }
        };

        // Poll every 3 seconds
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !data) return <div className="animate-pulse h-8 w-32 bg-white/5 rounded"></div>;

    let color = "text-slate-400";
    let icon = <Activity className="w-4 h-4" />;
    let text = "Connecting...";
    let subtext = "";

    if (data.status === "ACTIVE") {
        color = "text-emerald-400";
        icon = <Activity className="w-4 h-4 animate-pulse" />;
        text = "Worker Active";
        subtext = `Last: ${data.message.substring(0, 30)}... (${data.agoSeconds}s ago)`;
    } else if (data.status === "STALLED") {
        color = "text-amber-400";
        icon = <RefreshCcw className="w-4 h-4 animate-spin" />;
        text = "Restarting / Waiting...";
        subtext = `No signal for ${data.agoSeconds}s. Watchdog will auto-heal.`;
    } else if (data.status === "OFFLINE") {
        color = "text-rose-400";
        icon = <AlertTriangle className="w-4 h-4" />;
        text = "Worker Offline";
        subtext = `Last signal ${Math.round(data.agoSeconds / 60)}m ago.`;
    } else if (data.status === "PAUSED_BY_USER") {
        color = "text-slate-500";
        icon = <PauseCircle className="w-4 h-4" />;
        text = "Worker Paused";
        subtext = "Currently disabled in settings.";
    }

    return (
        <div className={`flex items-center gap-3 px-4 py-2 rounded-full border bg-black/20 backdrop-blur-md ${color} border-current/10 transition-all duration-500`}>
            {icon}
            <div className="flex flex-col leading-none">
                <span className="font-bold text-xs uppercase tracking-wider">{text}</span>
                {subtext && <span className="text-[10px] opacity-70 font-mono mt-0.5">{subtext}</span>}
            </div>
        </div>
    );
}
