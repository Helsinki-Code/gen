"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "../../lib/utils";

// ==========================================
// 1. ANIMATED WAVE BACKGROUND
// ==========================================
export function AnimatedWaveBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center opacity-50 dark:opacity-40">
      <motion.svg
        viewBox="0 0 1000 1000"
        className="w-[150%] h-[150%] min-w-[1200px]"
        preserveAspectRatio="xMidYMid slice"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
      >
        <motion.path
          d="M485.5 137.5C646.5 137.5 777.5 268.5 777.5 429.5C777.5 590.5 646.5 721.5 485.5 721.5C324.5 721.5 193.5 590.5 193.5 429.5C193.5 268.5 324.5 137.5 485.5 137.5Z"
          className="stroke-neutral-300 dark:stroke-white/10 transition-colors duration-500"
          strokeWidth="1.5"
          fill="none"
          animate={{
            d: [
              "M485.5 137.5C646.5 137.5 777.5 268.5 777.5 429.5C777.5 590.5 646.5 721.5 485.5 721.5C324.5 721.5 193.5 590.5 193.5 429.5C193.5 268.5 324.5 137.5 485.5 137.5Z",
              "M415.5 197.5C596.5 107.5 837.5 228.5 797.5 459.5C757.5 690.5 546.5 781.5 385.5 721.5C224.5 661.5 143.5 540.5 243.5 379.5C343.5 218.5 234.5 287.5 415.5 197.5Z",
              "M485.5 137.5C646.5 137.5 777.5 268.5 777.5 429.5C777.5 590.5 646.5 721.5 485.5 721.5C324.5 721.5 193.5 590.5 193.5 429.5C193.5 268.5 324.5 137.5 485.5 137.5Z"
            ]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M515.5 217.5C636.5 217.5 737.5 318.5 737.5 439.5C737.5 560.5 636.5 661.5 515.5 661.5C394.5 661.5 293.5 560.5 293.5 439.5C293.5 318.5 394.5 217.5 515.5 217.5Z"
          className="stroke-neutral-300 dark:stroke-white/10 transition-colors duration-500"
          strokeWidth="1.5"
          fill="none"
          animate={{
            d: [
              "M515.5 217.5C636.5 217.5 737.5 318.5 737.5 439.5C737.5 560.5 636.5 661.5 515.5 661.5C394.5 661.5 293.5 560.5 293.5 439.5C293.5 318.5 394.5 217.5 515.5 217.5Z",
              "M455.5 277.5C606.5 207.5 767.5 278.5 757.5 429.5C747.5 580.5 586.5 691.5 455.5 641.5C324.5 591.5 273.5 490.5 333.5 359.5C393.5 228.5 304.5 347.5 455.5 277.5Z",
              "M515.5 217.5C636.5 217.5 737.5 318.5 737.5 439.5C737.5 560.5 636.5 661.5 515.5 661.5C394.5 661.5 293.5 560.5 293.5 439.5C293.5 318.5 394.5 217.5 515.5 217.5Z"
            ]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.path
          d="M545.5 297.5C626.5 297.5 697.5 368.5 697.5 449.5C697.5 530.5 626.5 601.5 545.5 601.5C464.5 601.5 393.5 530.5 393.5 449.5C393.5 368.5 464.5 297.5 545.5 297.5Z"
          className="stroke-neutral-300 dark:stroke-white/10 transition-colors duration-500"
          strokeWidth="1.5"
          fill="none"
          animate={{
            d: [
              "M545.5 297.5C626.5 297.5 697.5 368.5 697.5 449.5C697.5 530.5 626.5 601.5 545.5 601.5C464.5 601.5 393.5 530.5 393.5 449.5C393.5 368.5 464.5 297.5 545.5 297.5Z",
              "M495.5 337.5C616.5 297.5 707.5 338.5 697.5 459.5C687.5 580.5 556.5 631.5 455.5 581.5C354.5 531.5 343.5 460.5 383.5 379.5C423.5 298.5 374.5 377.5 495.5 337.5Z",
              "M545.5 297.5C626.5 297.5 697.5 368.5 697.5 449.5C697.5 530.5 626.5 601.5 545.5 601.5C464.5 601.5 393.5 530.5 393.5 449.5C393.5 368.5 464.5 297.5 545.5 297.5Z"
            ]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        />
      </motion.svg>
    </div>
  );
}

// ==========================================
// 2. SCROLLING TESTIMONIALS
// ==========================================
type Review = {
  id?: string;
  name: string;
  role?: string;
  text: string;
  rating: number;
  avatar_url?: string;
};

const MOCK_REVIEWS: Review[] = [
  {
    id: "1",
    name: "James Harrington",
    role: "VP of Sales, Veridian SaaS",
    text: "AmroGen booked us 14 qualified meetings in the first week. The AI writes outreach that actually sounds like our team — not a template blast.",
    rating: 5,
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&q=80"
  },
  {
    id: "2",
    name: "Priya Nair",
    role: "Founder, Stacklayer.io",
    text: "We went from spending 3 hours a day on cold email to spending 20 minutes reviewing what the AI generated. Pipeline quality went up, not down.",
    rating: 5,
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&q=80"
  },
  {
    id: "3",
    name: "Marcus Webb",
    role: "Head of Growth, Fenix Analytics",
    text: "Our reply rate jumped to 18% within the first campaign. AmroGen's ICP scoring means we're only targeting people who would actually buy.",
    rating: 5,
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&q=80"
  },
  {
    id: "4",
    name: "Sofia Reyes",
    role: "Sales Director, Orion Cloud",
    text: "The review workflow is what sold me. I see exactly what goes out before it goes out. Approval takes 2 minutes. No more rogue SDR emails.",
    rating: 5,
    avatar_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&q=80"
  },
  {
    id: "5",
    name: "Daniel Okafor",
    role: "BDR Lead, Momentum CRM",
    text: "I used to dread building sequences. Now I paste a company URL and AmroGen handles research, personalization, and scheduling. It's genuinely magic.",
    rating: 5,
    avatar_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&q=80"
  }
];

const TestimonialCard = ({ review }: { review: Review }) => {
  const avatarText = review.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <motion.div
      className="bg-white dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/50 shadow-sm dark:shadow-none rounded-2xl p-6 mb-6 break-inside-avoid relative z-10 cursor-pointer backdrop-blur-sm transition-colors duration-500"
      whileHover={{
        scale: 1.03,
        y: -8,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05)"
      }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn("w-4 h-4", i < review.rating ? 'fill-orange-500 text-orange-500' : 'fill-neutral-800 text-neutral-800')}
          />
        ))}
      </div>
      <p className="text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed mb-6">&ldquo;{review.text}&rdquo;</p>
      <div className="flex items-center gap-3">
        {review.avatar_url ? (
          <img src={review.avatar_url} alt={review.name} className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400 font-bold text-xs border border-neutral-200 dark:border-neutral-700">
            {avatarText}
          </div>
        )}
        <div>
          <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{review.name}</div>
          <div className="text-xs text-neutral-500">{review.role || 'User'}</div>
        </div>
      </div>
    </motion.div>
  );
};

export function ScrollingTestimonials() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    const barVariants = {
      animate: {
        scaleY: [1, 1.5, 1],
        opacity: [0.5, 1, 0.5],
        transition: { repeat: Infinity, duration: 1, ease: "easeInOut" as const }
      }
    };

    return (
      <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px]">
        <AnimatedWaveBackground />

        <div className="relative z-10 flex flex-col items-center bg-white/40 dark:bg-zinc-900/40 p-8 rounded-3xl backdrop-blur-md border border-white/50 dark:border-zinc-800/50 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-orange-400 p-[2px] shadow-lg mb-6">
            <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center overflow-hidden">
              <span className="text-2xl font-black text-orange-500">UI</span>
            </div>
          </div>

          <div className="flex gap-1.5 h-6 items-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-orange-500 rounded-full h-full"
                variants={barVariants}
                animate="animate"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <motion.div
            className="mt-6 text-sm font-bold tracking-widest uppercase text-neutral-500 dark:text-neutral-400"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            Loading Reviews...
          </motion.div>
        </div>
      </div>
    );
  }

  const displayReviews = [...MOCK_REVIEWS, ...MOCK_REVIEWS, ...MOCK_REVIEWS];
  const col1 = displayReviews.slice(0, 5);
  const col2 = displayReviews.slice(5, 10);
  const col3 = displayReviews.slice(10, 15);

  return (
    <div className="w-full h-full relative flex flex-col">
      <AnimatedWaveBackground />

      <div className="w-full flex flex-col items-center justify-center pt-12 pb-8 bg-transparent relative z-30 px-4">
        <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4 text-center max-w-2xl leading-tight">
          Trusted by <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600">Sales Teams</span>
        </h2>
        <p className="text-zinc-400 text-base md:text-lg max-w-lg text-center mb-8">
          Real results from teams using AmroGen to automate outreach and close more deals.
        </p>
        <div className="w-full max-w-md h-1 bg-gradient-to-r from-zinc-600 via-zinc-400 to-zinc-600 rounded-full shadow-sm"></div>
      </div>

      <div className="absolute top-0 inset-x-0 h-72 bg-gradient-to-b from-zinc-50 dark:from-zinc-950 to-transparent z-20 pointer-events-none rounded-t-3xl mx-2 mt-2" />

      <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-zinc-50 dark:from-zinc-950 to-transparent z-20 pointer-events-none" />

      <div className="flex-1 overflow-hidden relative z-10 px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 h-full">
          <div className="flex flex-col overflow-hidden relative pt-8">
            <motion.div
              className="flex flex-col w-full"
              animate={{ y: ["0%", "-50%"] }}
              transition={{ repeat: Infinity, duration: 35, ease: "linear" }}
            >
              {[...col1, ...col1].map((review, i) => (
                <TestimonialCard key={`col1-${i}`} review={review} />
              ))}
            </motion.div>
          </div>
          <div className="hidden sm:flex flex-col overflow-hidden relative">
            <motion.div
              className="flex flex-col w-full"
              animate={{ y: ["-50%", "0%"] }}
              transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
            >
              {[...col2, ...col2].map((review, i) => (
                <TestimonialCard key={`col2-${i}`} review={review} />
              ))}
            </motion.div>
          </div>
          <div className="hidden lg:flex flex-col overflow-hidden relative pt-12">
            <motion.div
              className="flex flex-col w-full"
              animate={{ y: ["0%", "-50%"] }}
              transition={{ repeat: Infinity, duration: 45, ease: "linear" }}
            >
              {[...col3, ...col3].map((review, i) => (
                <TestimonialCard key={`col3-${i}`} review={review} />
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. LOGIN MARQUEE (4-QUADRANT SMART HOVER)
// ==========================================
interface HighlightItem {
  id: string;
  menuName: string;
  imageUrl: string | null;
}

const MOCK_HIGHLIGHTS: HighlightItem[] = [
  { id: '1', menuName: 'AI OUTREACH', imageUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=500&h=300&fit=crop&q=80' },
  { id: '2', menuName: 'COLD EMAIL', imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500&h=300&fit=crop&q=80' },
  { id: '3', menuName: 'PIPELINE AI', imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=300&fit=crop&q=80' },
  { id: '4', menuName: 'SMART SEQUENCES', imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&h=300&fit=crop&q=80' },
  { id: '5', menuName: 'ICP SCORING', imageUrl: null },
];

const SmartMarqueeItem = ({ item }: { item: HighlightItem }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [popConfig, setPopConfig] = useState({ x: 0, y: 0, rotate: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsHovered(true);

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const { clientX, clientY } = e;

    const distX = Math.abs(clientX - centerX);
    const distY = Math.abs(clientY - centerY);

    let newX = 0;
    let newY = 0;
    let newRotate = 0;

    if (distY > distX) {
      if (clientY < centerY) {
        newY = -120;
        newRotate = clientX < centerX ? -8 : 8;
      } else {
        newY = 120;
        newRotate = clientX < centerX ? 8 : -8;
      }
    } else {
      if (clientX < centerX) {
        newX = 140;
        newRotate = 12;
      } else {
        newX = -140;
        newRotate = -12;
      }
    }

    setPopConfig({ x: newX, y: newY, rotate: newRotate });
  };

  return (
    <div
      className="relative flex items-center gap-16 shrink-0 font-sans cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={cn(
          "text-5xl md:text-7xl font-black tracking-tighter uppercase transition-colors duration-300",
          isHovered ? "text-orange-500" : "text-zinc-900/60 dark:text-zinc-800/20"
        )}
      >
        {item.menuName}
      </span>

      {item.imageUrl && (
        <motion.div
          className="absolute z-[100] left-1/2 top-1/2 -ml-14 -mt-18 md:-ml-20 md:-mt-26 w-28 h-36 md:w-40 md:h-52 pointer-events-none shadow-2xl rounded-xl bg-white overflow-hidden origin-center"
          initial={{ scale: 0, opacity: 0, x: 0, y: 0, rotate: 0 }}
          animate={isHovered ? {
            scale: 1,
            opacity: 1,
            x: popConfig.x,
            y: popConfig.y,
            rotate: popConfig.rotate
          } : {
            scale: 0,
            opacity: 0,
            x: 0,
            y: 0,
            rotate: 0
          }}
          transition={{ type: "spring", stiffness: 350, damping: 20 }}
        >
          <img src={item.imageUrl} alt={item.menuName} className="w-full h-full object-cover" />
        </motion.div>
      )}
    </div>
  );
};

export const LoginMarquee: React.FC = () => {
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);

  useEffect(() => {
    setHighlights(MOCK_HIGHLIGHTS);
  }, []);

  if (highlights.length === 0) return <div className="absolute inset-0 bg-zinc-950" />;

  const TOTAL_ROWS = 8;
  const horizontalLoop = Array(5).fill(null);

  return (
    <div className="absolute inset-0 bg-zinc-950 flex flex-col justify-center overflow-hidden py-2 gap-6 select-none z-0">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-zinc-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent z-10 pointer-events-none" />

      {Array.from({ length: TOTAL_ROWS }).map((_, rowIndex) => {
        const item = highlights[rowIndex % highlights.length];
        const isEven = rowIndex % 2 === 0;

        return (
          <div key={`${item.id}-${rowIndex}`} className="w-full flex items-center py-2">
              <motion.div
              className="flex items-center whitespace-nowrap gap-16 w-max"
              animate={{ x: isEven ? ["0%", "-50%"] : ["-50%", "0%"] }}
              transition={{ repeat: Infinity, ease: "linear", duration: 40 }}
            >
              {[...horizontalLoop, ...horizontalLoop].map((_, idx) => (
                <SmartMarqueeItem key={idx} item={item} />
              ))}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 4. MAIN AUTH LAYOUT (DEFAULT EXPORT)
// ==========================================
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark w-full h-screen overflow-hidden flex flex-col lg:flex-row bg-zinc-950 font-sans transition-colors duration-500">

      {/* LEFT PANEL */}
      <div className="w-full lg:w-1/2 h-full relative flex items-center justify-center p-4 bg-transparent z-10 shadow-2xl">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <LoginMarquee />
        </div>

        <div className="relative z-50 w-full max-w-md p-6 md:p-8 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 isolate">
          {children}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="hidden lg:flex w-full lg:w-1/2 h-full overflow-hidden p-8 lg:p-12 bg-gradient-to-br from-zinc-50 to-zinc-100/50 dark:from-zinc-950 dark:to-zinc-900 transition-colors duration-500 relative border-l border-zinc-200/50 dark:border-zinc-800/50">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent z-0 pointer-events-none" />

        <div className="relative z-10 w-full h-full flex flex-col justify-center">
          <ScrollingTestimonials />
        </div>
      </div>

    </div>
  );
}
