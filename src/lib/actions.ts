"use server";

import prisma from "./prisma";
import { revalidatePath } from "next/cache";

export async function createCampaign(formData: FormData) {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const fields = formData.get("fields") as string;
    const linksRaw = formData.get("links") as string;
    const headless = formData.get("headless") === "on"; // Checkbox value

    if (!name || !fields || !linksRaw) {
        throw new Error("Missing required fields");
    }

    const links = linksRaw.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    await prisma.campaign.create({
        data: {
            name,
            description,
            fields,
            status: "RUNNING",
            headless,
            links: {
                create: links.map(url => ({ url }))
            }
        }
    });

    revalidatePath("/");
    return { success: true };
}

export async function toggleCampaign(id: string, currentStatus: string) {
    const newStatus = currentStatus === "RUNNING" ? "PAUSED" : "RUNNING";
    await prisma.campaign.update({
        where: { id },
        data: { status: newStatus },
    });
    revalidatePath("/");
}

export async function deleteCampaign(id: string) {
    await prisma.campaign.delete({ where: { id } });
    revalidatePath("/");
}
