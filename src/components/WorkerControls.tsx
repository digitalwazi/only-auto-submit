"use client";

import { useState, useEffect } from "react";
import { getSettings, updateSettings } from "@/lib/settings";
import { triggerRestart } from "@/lib/logs";
import { Power, Settings2, Loader2, RefreshCw, Clock } from "lucide-react";

export default function WorkerControls() {
    const [isOn, setIsOn] = useState(true);
    const [threads, setThreads] = useState(4);
    const [autoRestart, setAutoRestart] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [restarting, setRestarting] = useState(false);

    useEffect(() => {
        getSettings()
            .then((s) => {
                if (s) {
                    setIsOn(s.isWorkerOn);
                    setThreads(s.concurrency);
                    setAutoRestart(s.autoRestartInterval || 0);
                }
            })
            .catch((e) => console.error("Failed to load settings:", e))
            .finally(() => setLoading(false));
    }, []);

    async function handleToggle() {
        setSaving(true);
        const newState = !isOn;
        setIsOn(newState);
        await updateSettings(threads, newState, autoRestart);
        setSaving(false);
    }

    async function handleThreadsChange(e: React.ChangeEvent<HTMLInputElement>) {
        const val = parseInt(e.target.value);
        setThreads(val);
    }

    async function saveSettings() {
        setSaving(true);
        await updateSettings(threads, isOn, autoRestart);
        setSaving(false);
    }

    async function handleRestart() {
        if (!confirm("Are you sure you want to FORCE RESTART the worker? This will stop all current tasks.")) return;
        setRestarting(true);
        await triggerRestart();
        // Page will likely become unresponsive for a moment, that's expected
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    }

    async function handleAutoRestartChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const val = parseInt(e.target.value);
        setAutoRestart(val);
        setSaving(true);
        await updateSettings(threads, isOn, val);
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
                {/* Concurrency */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Settings2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Concurrency</span>
                    </div>
                    <span className="text-xl font-bold font-mono text-indigo-400">{threads}</span>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500 font-mono">1</span>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={threads}
                        onChange={handleThreadsChange}
                        onMouseUp={saveSettings}
                        onTouchEnd={saveSettings}
                        className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                    />
                    <span className="text-xs text-slate-500 font-mono">10</span>
                </div>

                {/* Auto Restart */}
                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Auto Restart</span>
                    </div>
                    <select
                        value={autoRestart}
                        onChange={handleAutoRestartChange}
                        disabled={saving}
                        className="bg-slate-800 border-none text-xs rounded px-2 py-1 text-slate-300 focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value={0}>Disabled</option>
                        <option value={15}>Every 15 mins</option>
                        <option value={30}>Every 30 mins</option>
                        <option value={60}>Every 1 hour</option>
                        <option value={240}>Every 4 hours</option>
                    </select>
                </div>

                {/* Manual Restart */}
                <button
                    onClick={handleRestart}
                    disabled={restarting}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white py-2 rounded-lg text-xs font-medium transition-all group"
                >
                    <RefreshCw className={`w-3 h-3 ${restarting ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
                    {restarting ? "Restarting Server..." : "Force Restart Server"}
                </button>

                <p className="text-[10px] text-slate-500 text-center">
                    Higher threads = faster speed. Restart if memory usage gets high.
                </p>
            </div>
        </div>
    );
}
