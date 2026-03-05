import { NextRequest, NextResponse } from "next/server";
import { getJson } from "serpapi";
import { ApifyClient } from "apify-client";

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const APIFY_TOKEN = process.env.APIFY_TOKEN;

export async function POST(req: NextRequest) {
    try {
        const { keyword } = await req.json();

        if (!keyword) {
            return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
        }

        if (!SERPAPI_KEY || !APIFY_TOKEN) {
            return NextResponse.json({ error: "API tokens not configured" }, { status: 500 });
        }

        // 1. Search for Threads URLs using SerpApi
        const searchParams = {
            engine: "google",
            q: `site:threads.net ${keyword}`,
            tbs: "qdr:w", // last week
            api_key: SERPAPI_KEY,
            num: 20
        };

        const searchResults = await getJson(searchParams);

        let urls: string[] = [];
        if (searchResults.organic_results) {
            urls = searchResults.organic_results
                .map((res: any) => res.link)
                .filter((link: string) => link && link.includes("threads.net") && (link.includes("/post/") || link.includes("/@")));
        }

        // Clean URLs
        urls = Array.from(new Set(urls.map(u => u.split('?')[0])));

        if (urls.length === 0) {
            return NextResponse.json({ results: [], message: "No new threads found for this keyword." });
        }

        // 2. Scrape data using Apify
        const client = new ApifyClient({ token: APIFY_TOKEN });
        const runInput = {
            startUrls: urls.map(url => ({ url })),
            maxItems: 50,
            proxyConfiguration: { useApifyProxy: true }
        };

        const run = await client.actor("logical_scrapers/threads-post-scraper").call({ runInput });
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        // 3. Process results (Porting logic from main.py)
        const processedRows: any[] = [];

        items.forEach((item: any) => {
            // Main post
            const thread = item.thread;
            if (thread) {
                processedRows.push({
                    url: thread.url || "N/A",
                    username: thread.username || "N/A",
                    text: thread.text || "",
                    likes: thread.like_count || 0,
                    replies: thread.reply_count || 0,
                    date: thread.published_on
                        ? new Date(thread.published_on * 1000).toLocaleString()
                        : "N/A",
                    user_pic: thread.user_pic || null
                });
            }

            // Replies
            if (item.replies && Array.isArray(item.replies)) {
                item.replies.forEach((reply: any) => {
                    processedRows.push({
                        url: reply.url || "N/A",
                        username: reply.username || "N/A",
                        text: reply.text || "",
                        likes: reply.like_count || 0,
                        replies: reply.reply_count || 0,
                        date: reply.published_on
                            ? new Date(reply.published_on * 1000).toLocaleString()
                            : "N/A",
                        user_pic: reply.user_pic || null
                    });
                });
            }
        });

        // Filter by keyword in text and sort by likes
        const filteredResults = processedRows
            .filter(row => row.text.toLowerCase().includes(keyword.toLowerCase()))
            .sort((a, b) => b.likes - a.likes);

        return NextResponse.json({ results: filteredResults });

    } catch (error: any) {
        console.error("Search API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
