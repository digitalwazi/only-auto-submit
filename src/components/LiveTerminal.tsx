"use client";

import { useEffect, useRef, useState } from "react";
import { getRecentLogs } from "@/lib/logs";

interface Log {
    id: number;
    message: string;
    type: string;
    createdAt: Date;
}

export default function LiveTerminal() {
    const [logs, setLogs] = useState<Log[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initial fetch
        fetchLogs();

        // Poll every 2 seconds
        const interval = setInterval(fetchLogs, 2000);
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            const recent = await getRecentLogs();
            setLogs(recent.reverse()); // Show oldest first (top to bottom)
        } catch (e) {
            console.error("Failed to fetch logs", e);
        }
    };

    // Auto-scroll to bottom directly
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getColor = (type: string) => {
        switch (type) {
            case "SUCCESS": return "text-emerald-400";
            case "ERROR": return "text-rose-400";
            case "WARN": return "text-amber-400";
            default: return "text-slate-300";
        }
    };

    return (
        <div className="w-full bg-slate-900 rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden flex flex-col mb-6">
            {/* Header */}
            <div className="bg-slate-800/80 px-4 py-2 flex items-center justify-between border-b border-slate-700/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                        <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="ml-3 text-xs font-mono text-slate-400 font-medium">~/auto-submitter/worker-logs</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500">Live</span>
                </div>
            </div>

            {/* Terminal Body */}
            <div
                ref={scrollRef}
                className="h-64 overflow-y-auto p-4 font-mono text-xs md:text-sm space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
            >
                {logs.length === 0 && (
                    <div className="text-slate-500 italic">Waiting for worker signal...</div>
                )}
                {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 animate-in fade-in duration-300">
                        <span className="text-slate-500 shrink-0 select-none">
                            {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                        <span className={`${getColor(log.type)} break-all`}>
                            <span className="opacity-50 mr-2">
                                {log.type === 'INFO' ? '>' : log.type === 'SUCCESS' ? '✔' : log.type === 'ERROR' ? '✘' : '!'}
                            </span>
                            {log.message}
                        </span>
                    </div>
                ))}
                {/* Cursor */}
                <div className="animate-pulse text-emerald-500 font-bold">_</div>
            </div>
        </div>
    );
}
