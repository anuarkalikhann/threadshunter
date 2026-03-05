"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Sparkles, Download } from "lucide-react";
import PostCard from "@/components/PostCard";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Access Telegram through the window object (loaded via Script in layout.tsx)
    if (typeof window !== "undefined") {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();

        if (tg.backgroundColor) {
          document.body.style.backgroundColor = tg.backgroundColor;
        }
      }
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!keyword.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data.results || []);
      if (data.results?.length === 0) {
        setError("No results found. Try another keyword.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch threads");
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = ["Username", "Text", "Likes", "Replies", "Date", "URL"];
    const csvContent = [
      headers.join(";"),
      ...results.map(r => [
        `@${r.username}`,
        `"${r.text.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        r.likes,
        r.replies,
        r.date,
        r.url
      ].join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `threads_${keyword}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 mb-4"
        >
          <Sparkles className="text-white" size={32} />
        </motion.div>
        <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-violet-300 to-fuchsia-400 mb-2">
          Threads Hunter
        </h1>
        <p className="text-neutral-400 text-sm">
          Monitoring the pulse of Threads.net
        </p>
      </header>

      <form onSubmit={handleSearch} className="mb-10">
        <div className="relative">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Enter keyword (e.g. AI agents)"
            className="w-full bg-neutral-900/50 border border-neutral-800 rounded-2xl px-6 py-4 pl-12 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
          <button
            type="submit"
            disabled={isLoading || !keyword.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 threads-button px-4 py-2 rounded-xl disabled:opacity-50 disabled:transform-none"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Search"}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
          {results.length > 0 ? `Results (${results.length})` : "Start Hunting"}
        </h2>
        {results.length > 0 && (
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-4" />
            <p className="text-neutral-400 animate-pulse">Scanning Threads universe...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 text-center glass-card border-red-500/20"
          >
            <p className="text-red-400">{error}</p>
          </motion.div>
        ) : (
          <div className="pb-20">
            {results.map((post, i) => (
              <PostCard key={post.url + i} post={post} index={i} />
            ))}
          </div>
        )}
      </AnimatePresence>

      {!isLoading && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-10 text-neutral-500">
          <div className="w-20 h-20 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
            <Search size={32} />
          </div>
          <p className="text-center text-sm px-10">
            Enter a keyword above to find the most liked posts on Threads.
          </p>
        </div>
      )}
    </main>
  );
}
