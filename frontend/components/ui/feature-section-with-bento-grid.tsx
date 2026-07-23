import { Target, Sparkles, CheckCircle2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function Feature() {
  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="flex flex-col gap-10">
          <div className="flex gap-4 flex-col items-start">
            <div>
              <Badge>AI SDR Platform</Badge>
            </div>
            <div className="flex gap-2 flex-col">
              <h2 className="text-3xl md:text-5xl tracking-tighter max-w-xl font-regular text-left">
                Five agents. One campaign. Zero manual SDR work.
              </h2>
              <p className="text-lg max-w-xl lg:max-w-lg leading-relaxed tracking-tight text-muted-foreground text-left">
                AmroGen runs lead discovery, copywriting, review, and sending automatically — you approve what goes out.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-muted rounded-md h-full lg:col-span-2 p-6 aspect-square lg:aspect-auto flex justify-between flex-col">
              <Target className="w-8 h-8 stroke-1 text-primary" />
              <div className="flex flex-col">
                <h3 className="text-xl tracking-tight">AI lead discovery</h3>
                <p className="text-muted-foreground max-w-xs text-base">
                  Paste any company URL. AmroGen finds verified decision-makers with titles, LinkedIn, and direct email — no manual research required.
                </p>
              </div>
            </div>
            <div className="bg-muted rounded-md aspect-square p-6 flex justify-between flex-col">
              <Sparkles className="w-8 h-8 stroke-1 text-primary" />
              <div className="flex flex-col">
                <h3 className="text-xl tracking-tight">Personalised sequences</h3>
                <p className="text-muted-foreground max-w-xs text-base">
                  Multi-touch email, LinkedIn, and SMS copy written fresh for every lead using real account context.
                </p>
              </div>
            </div>

            <div className="bg-muted rounded-md aspect-square p-6 flex justify-between flex-col">
              <CheckCircle2 className="w-8 h-8 stroke-1 text-primary" />
              <div className="flex flex-col">
                <h3 className="text-xl tracking-tight">Human review loop</h3>
                <p className="text-muted-foreground max-w-xs text-base">
                  Every sequence lands in your approval inbox. Edit inline or approve in bulk — nothing sends without your sign-off.
                </p>
              </div>
            </div>
            <div className="bg-muted rounded-md h-full lg:col-span-2 p-6 aspect-square lg:aspect-auto flex justify-between flex-col">
              <Mail className="w-8 h-8 stroke-1 text-primary" />
              <div className="flex flex-col">
                <h3 className="text-xl tracking-tight">Gmail-native sending</h3>
                <p className="text-muted-foreground max-w-xs text-base">
                  Sends from your own Gmail account via the official API. No new inboxes, no domain warm-up, no shared sending IP risk.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Feature };
