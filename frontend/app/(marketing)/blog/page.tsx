import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ImageIcon } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/MarketingPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Blog7 } from "@/components/blocks/blog7";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "AmroGen Blog - AI SDR, B2B Lead Generation, and Cold Outreach Guides",
  description:
    "Research-backed guides on AI SDR tools, B2B lead generation, cold email, personalization, and outbound automation.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const featured = posts.slice(0, 3);
  const rest = posts.slice(3);

  const blog7Posts = featured.map((p) => ({
    id: p.slug,
    title: p.title,
    summary: p.excerpt,
    label: p.primaryKeyword || "Article",
    author: "AmroGen",
    published: "",
    url: `/blog/${p.slug}`,
    image: p.images[0]?.src || `/images/block/placeholder-dark-1.svg`,
  }));

  return (
    <main className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-0">
        <Badge className="mb-6">AmroGen resources</Badge>
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
          AI SDR, lead generation, and cold outreach guides.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          Long-form, research-backed articles built around the AmroGen SEO clusters.
        </p>
      </section>

      {/* Featured 3 posts — Blog7 card grid */}
      {blog7Posts.length > 0 && (
        <Blog7
          tagline="Latest articles"
          heading="Featured guides"
          description="Our most-read guides on AI-powered outbound, lead generation, and cold email strategy."
          buttonText="View all articles"
          buttonUrl="/blog"
          posts={blog7Posts}
        />
      )}

      {/* Rest of posts — existing grid */}
      {rest.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">More articles</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="overflow-hidden rounded-lg border border-border bg-card/70 transition-colors hover:border-primary/50"
              >
                {post.images[0] ? (
                  <img
                    src={post.images[0].src}
                    alt={post.images[0].alt || post.title}
                    className="aspect-[16/9] w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[16/9] w-full items-center justify-center bg-secondary/60 text-muted-foreground">
                    <ImageIcon size={28} />
                  </div>
                )}
                <div className="p-6">
                  <div className="text-xs uppercase tracking-[0.16em] text-primary">{post.primaryKeyword}</div>
                  <h2 className="mt-3 text-xl font-semibold leading-snug">{post.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Fallback if fewer than 4 posts total */}
      {posts.length > 0 && posts.length <= 3 && (
        <section className="mx-auto max-w-6xl px-6 pb-24 text-center">
          <Button asChild variant="outline">
            <Link href="/sign-up">
              Start your first campaign
              <ArrowRight size={14} />
            </Link>
          </Button>
        </section>
      )}

      <MarketingFooter />
    </main>
  );
}
