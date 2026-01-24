"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkerPinger() {
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                // Passive check only - do not trigger run
                // const res = await fetch("/api/worker/run"); 
                console.log("Client connected. Background worker should be running on server.");
            } catch (e) {
                console.error("Connection check failed", e);
            }
        }, 10000); // Ping every 10 seconds

        return () => clearInterval(interval);
    }, [router]);

    return null; // Invisible component
}
