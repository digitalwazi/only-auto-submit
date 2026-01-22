"use server";

import prisma from "./prisma";
import { revalidatePath } from "next/cache";

export async function createCampaign(formData: FormData) {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const fieldsJson = formData.get("fields") as string; // Expecting JSON string from client
    const linksRaw = formData.get("links") as string; // Expecting textarea blob

    const campaign = await prisma.campaign.create({
        data: {
            name,
            description,
            fields: fieldsJson,
            status: "PAUSED",
        },
    });

    // Process links in batches to handle "lakhs"
    const links = linksRaw.split("\n").map(l => l.trim()).filter(l => l !== "");
    const batchSize = 1000;
    for (let i = 0; i < links.length; i += batchSize) {
        const batch = links.slice(i, i + batchSize);
        await prisma.link.createMany({
            data: batch.map(url => ({
                url,
                campaignId: campaign.id,
            })),
        });
    }

    revalidatePath("/");
    return { success: true, id: campaign.id };
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
