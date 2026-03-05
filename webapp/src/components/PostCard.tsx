"use client";

import { motion } from "framer-motion";
import { Heart, MessageCircle, ExternalLink, User } from "lucide-react";

interface PostCardProps {
    post: {
        url: string;
        username: string;
        text: string;
        likes: number;
        replies: number;
        date: string;
        user_pic?: string | null;
    };
    index: number;
}

export default function PostCard({ post, index }: PostCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card p-4 mb-4"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden mr-3">
                        {post.user_pic ? (
                            <img src={post.user_pic} alt={post.username} className="w-full h-full object-cover" />
                        ) : (
                            <User size={20} className="text-neutral-400" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">@{post.username}</h3>
                        <p className="text-[10px] text-neutral-400">{post.date}</p>
                    </div>
                </div>
                <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-white/10 text-neutral-400 transition-colors"
                >
                    <ExternalLink size={16} />
                </a>
            </div>

            <p className="text-white/90 text-[14px] leading-relaxed mb-4 whitespace-pre-wrap">
                {post.text}
            </p>

            <div className="flex items-center gap-6 text-neutral-400">
                <div className="flex items-center gap-1.5">
                    <Heart size={16} className={post.likes > 0 ? "text-pink-500 fill-pink-500" : ""} />
                    <span className="text-xs font-medium">{post.likes}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <MessageCircle size={16} />
                    <span className="text-xs font-medium">{post.replies}</span>
                </div>
            </div>
        </motion.div>
    );
}
