import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingNav } from "@/components/MarketingPage";
import { Badge } from "@/components/ui/badge";
import { getAllPosts, getPost } from "@/lib/blog";
import { siteUrl } from "@/lib/marketing-content";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.metaTitle,
    description: post.metaDescription,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      type: "article",
      images: post.images[0] ? [post.images[0].src] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    url: `${siteUrl}/blog/${post.slug}`,
    image: post.images.map((image) => `${siteUrl}${image.src}`),
    author: { "@type": "Organization", name: "AmroGen" },
    publisher: { "@type": "Organization", name: "AmroGen" },
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
  };

  const faqSchema =
    post.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }
      : null;

  return (
    <main className="min-h-screen bg-background">
      <MarketingNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema).replace(/</g, "\\u003c") }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }}
        />
      )}
      <article className="mx-auto max-w-4xl px-6 py-14">
        <Badge className="mb-5">{post.primaryKeyword}</Badge>
        {post.audioUrl && (
          <section className="mb-8 rounded-lg border border-border bg-secondary/40 p-4">
            <div className="mb-3">
              <h2 className="text-base font-semibold">Voice explainer</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Listen to the article summary generated for this AmroGen guide.
              </p>
            </div>
            <audio controls className="w-full" src={post.audioUrl} />
          </section>
        )}
        <div
          className="amrogen-markdown"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </article>
      <MarketingFooter />
    </main>
  );
}
