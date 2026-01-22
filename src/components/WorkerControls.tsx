"use client";

import { useState, useEffect } from "react";
import { getSettings, updateSettings } from "@/lib/settings";
import { Power, Settings2, Loader2 } from "lucide-react";

export default function WorkerControls() {
    const [isOn, setIsOn] = useState(true);
    const [threads, setThreads] = useState(4);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getSettings().then((s) => {
            setIsOn(s.isWorkerOn);
            setThreads(s.concurrency);
            setLoading(false);
        });
    }, []);

    async function handleToggle() {
        setSaving(true);
        const newState = !isOn;
        setIsOn(newState);
        await updateSettings(threads, newState);
        setSaving(false);
    }

    async function handleThreadsChange(e: React.ChangeEvent<HTMLInputElement>) {
        const val = parseInt(e.target.value);
        setThreads(val);
    }

    async function saveThreads() {
        setSaving(true);
        await updateSettings(threads, isOn);
        setSaving(false);
    }

    if (loading) return <div className="animate-pulse h-20 bg-white/5 rounded-xl"></div>;

    return (
        <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-colors ${isOn ? "bg-emerald-500/20 text-emerald-400 shadow-emerald-500/10" : "bg-red-500/20 text-red-400 shadow-red-500/10"}`}>
                        <Power className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Worker Status</h3>
                        <p className="text-xs text-slate-400">{isOn ? "System Active" : "System Paused"}</p>
                    </div>
                </div>
                <button
                    onClick={handleToggle}
                    disabled={saving}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${isOn
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                        : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                        }`}
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (isOn ? "Stop All" : "Start System")}
                </button>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Settings2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Concurrency (Threads)</span>
                    </div>
                    <span className="text-2xl font-bold font-mono text-indigo-400">{threads}</span>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500 font-mono">1</span>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={threads}
                        onChange={handleThreadsChange}
                        onMouseUp={saveThreads}
                        onTouchEnd={saveThreads}
                        className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                    />
                    <span className="text-xs text-slate-500 font-mono">10</span>
                </div>
                <p className="text-xs text-slate-500 text-center">
                    Higher threads = faster speed but more CPU usage.
                </p>
            </div>
        </div>
    );
}
