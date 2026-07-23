"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

const SMALL_BREAKPOINT = 570;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
};

const childVariants = {
  hidden: { opacity: 0, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.5 },
  },
};

function useWindowWidth() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setWidth(window.innerWidth);
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}

const WaitlistForm = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const width = useWindowWidth();

  const triggerBasicConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    triggerBasicConfetti();
  }, []);

  const ThankYouMessage = (
    <motion.div
      layout
      initial={{ opacity: 0, filter: "blur(10px)" }}
      animate={{
        opacity: 1,
        filter: "blur(0px)",
        transition: { duration: 0.5 },
      }}
      exit={{
        opacity: 0,
        filter: "blur(10px)",
        transition: { duration: 0.5 },
      }}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-medium text-foreground">
          You&apos;re on the list!
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          We&apos;ll notify you with updates soon. In the meantime,{" "}
          <Link href="/sign-up" className="text-primary underline underline-offset-4">
            start your first campaign →
          </Link>
        </p>
      </div>
    </motion.div>
  );

  const FormContent = (
    <motion.div
      layout
      key="form"
      className="w-full"
      initial={{ opacity: 0, filter: "blur(10px)" }}
      animate={{
        opacity: 1,
        filter: "blur(0px)",
        transition: { duration: 0.5 },
      }}
      exit={{
        opacity: 0,
        filter: "blur(10px)",
        transition: { duration: 0.5 },
      }}
    >
      <motion.div
        className={`${
          width <= SMALL_BREAKPOINT ? "text-left mb-4" : "text-center mb-8"
        }`}
        variants={childVariants}
      >
        <h1 className="text-4xl font-medium text-foreground">
          Be first to automate outreach with
          <span
            className={`pl-2 ${
              width <= SMALL_BREAKPOINT ? "" : "block"
            } bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent`}
          >
            AmroGen
          </span>
        </h1>
      </motion.div>

      <motion.form
        onSubmit={handleSubmit}
        className={
          width <= SMALL_BREAKPOINT
            ? "flex flex-col gap-4 items-start w-full"
            : "relative w-full"
        }
        variants={childVariants}
      >
        <div
          className={
            width <= SMALL_BREAKPOINT
              ? "flex flex-col gap-4 w-full"
              : "flex flex-row items-center w-full space-x-4 rounded-full border border-border bg-background/80 p-2"
          }
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className={`${
              width <= SMALL_BREAKPOINT
                ? "px-4 py-4 w-full text-lg focus:outline-none rounded-full border border-border bg-background text-foreground placeholder:text-muted-foreground"
                : "flex-1 rounded-full bg-transparent px-4 py-4 text-lg focus:outline-none text-foreground placeholder:text-muted-foreground"
            }`}
            required
          />
          <button
            type="submit"
            className={`${
              width <= SMALL_BREAKPOINT
                ? "rounded-full bg-primary px-6 py-4 text-lg font-medium text-primary-foreground hover:bg-primary/90 transition w-full"
                : "rounded-full bg-primary px-6 py-4 text-lg font-medium text-primary-foreground hover:bg-primary/90 transition"
            }`}
          >
            Get early access
          </button>
        </div>
      </motion.form>
    </motion.div>
  );

  return (
    <motion.div
      layout
      className={`w-[95%] max-w-2xl rounded-2xl bg-card border border-border shadow-xl ${
        width <= SMALL_BREAKPOINT ? "p-8" : "p-12"
      } min-h-[300px] flex items-center`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence mode="wait">
        {!submitted ? FormContent : ThankYouMessage}
      </AnimatePresence>
    </motion.div>
  );
};

export { WaitlistForm };
