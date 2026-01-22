"use client";

import { useState, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    const PASSCODE = "900912";

    useEffect(() => {
        // Check session storage on mount
        const storedAuth = sessionStorage.getItem("is_authenticated");
        if (storedAuth === "true") {
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === PASSCODE) {
            sessionStorage.setItem("is_authenticated", "true");
            setIsAuthenticated(true);
            setError(false);
        } else {
            setError(true);
            setPassword("");
        }
    };

    if (loading) return null; // Prevent flash

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="glass-card max-w-sm w-full p-8 rounded-2xl border border-white/10 shadow-2xl shadow-indigo-500/10">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center">
                            <Lock className="w-8 h-8 text-indigo-400" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-center mb-2">Restricted Access</h2>
                    <p className="text-slate-400 text-center text-sm mb-8">Enter the security passcode to continue.</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError(false);
                                }}
                                placeholder="Passcode"
                                autoFocus
                                className={`w-full bg-black/20 border ${error ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-indigo-500'} rounded-lg px-4 py-3 outline-none transition-all text-center tracking-widest text-lg`}
                            />
                            {error && <p className="text-red-400 text-xs text-center mt-2 animate-pulse">Incorrect passcode</p>}
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Unlock className="w-4 h-4" />
                            Unlock System
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
