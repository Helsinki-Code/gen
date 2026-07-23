"use client";

import React from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock, Mail, Menu, MessageSquare, MoreHorizontal, Search, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatedGroup } from '@/components/ui/animated-group'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

const transitionVariants = {
    item: {
        hidden: {
            opacity: 0,
            filter: 'blur(12px)',
            y: 12,
        },
        visible: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: {
                type: 'spring',
                bounce: 0.3,
                duration: 1.5,
            },
        },
    },
}

export function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden">
                {/* Radial light-burst backdrop */}
                <div
                    aria-hidden
                    className="z-[2] absolute inset-0 pointer-events-none isolate opacity-50 contain-strict hidden lg:block">
                    <div className="w-[35rem] h-[80rem] -translate-y-[350px] absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsl(var(--primary)/0.15)_0,hsl(var(--primary)/0.04)_50%,transparent_80%)]" />
                    <div className="h-[80rem] absolute left-0 top-0 w-56 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsl(var(--primary)/0.1)_0,hsl(var(--primary)/0.03)_80%,transparent_100%)] [translate:5%_-50%]" />
                    <div className="h-[80rem] -translate-y-[350px] absolute left-0 top-0 w-56 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsl(var(--accent)/0.06)_0,transparent_80%)]" />
                </div>

                {/* Hero section */}
                <section>
                    <div className="relative pt-24 md:pt-36">
                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: { delayChildren: 1 },
                                    },
                                },
                                item: {
                                    hidden: { opacity: 0, y: 20 },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        transition: { type: 'spring', bounce: 0.3, duration: 2 },
                                    },
                                },
                            }}
                            className="absolute inset-0 -z-20">
                            <img
                                src="https://ik.imagekit.io/lrigu76hy/tailark/night-background.jpg?updatedAt=1745733451120"
                                alt=""
                                className="absolute inset-x-0 top-56 -z-20 hidden lg:top-32 dark:block"
                                width="3276"
                                height="4095"
                            />
                        </AnimatedGroup>

                        {/* Gradient fade into background */}
                        <div aria-hidden className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--background)_75%)]" />

                        <div className="mx-auto max-w-7xl px-6">
                            <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                                <AnimatedGroup variants={transitionVariants}>
                                    {/* Announcement chip */}
                                    <Link
                                        href="/sign-up"
                                        className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-black/5 transition-all duration-300 dark:border-t-white/5 dark:shadow-zinc-950">
                                        <span className="text-foreground text-sm">
                                            5 AI agents · one company URL · reviewed outreach
                                        </span>
                                        <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700" />
                                        <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                                            <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                                                <span className="flex size-6"><ArrowRight className="m-auto size-3" /></span>
                                                <span className="flex size-6"><ArrowRight className="m-auto size-3" /></span>
                                            </div>
                                        </div>
                                    </Link>

                                    <h1 className="mt-8 max-w-4xl mx-auto text-balance text-6xl md:text-7xl lg:mt-16 xl:text-[5.25rem] font-bold tracking-tight">
                                        Turn any company URL into a{' '}
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                                            live outreach campaign
                                        </span>
                                    </h1>

                                    <p className="mx-auto mt-8 max-w-2xl text-balance text-lg text-muted-foreground">
                                        AI agents research leads, build personalized sequences, and score every contact.
                                        You review once — then approve. AmroGen handles the rest.
                                    </p>
                                </AnimatedGroup>

                                <AnimatedGroup
                                    variants={{
                                        container: {
                                            visible: {
                                                transition: { staggerChildren: 0.05, delayChildren: 0.75 },
                                            },
                                        },
                                        ...transitionVariants,
                                    }}
                                    className="mt-12 flex flex-col items-center justify-center gap-2 md:flex-row">
                                    <div className="bg-foreground/10 rounded-[14px] border p-0.5">
                                        <Button asChild size="lg" className="rounded-xl px-5 text-base">
                                            <Link href="/sign-up">
                                                <span className="text-nowrap">Get started</span>
                                                <ArrowRight size={16} />
                                            </Link>
                                        </Button>
                                    </div>
                                    <Button asChild size="lg" variant="ghost" className="h-10.5 rounded-xl px-5">
                                        <Link href="/sign-in">
                                            <span className="text-nowrap">Sign in</span>
                                        </Link>
                                    </Button>
                                </AnimatedGroup>
                            </div>
                        </div>

                        {/* Dashboard preview */}
                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: { staggerChildren: 0.05, delayChildren: 0.75 },
                                    },
                                },
                                ...transitionVariants,
                            }}>
                            <div className="relative mt-8 overflow-hidden px-2 sm:mt-12 md:mt-20">
                                <div
                                    aria-hidden
                                    className="bg-gradient-to-b to-background absolute inset-0 z-10 from-transparent from-35%"
                                />
                                <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[hsl(216,37%,7%)] shadow-2xl shadow-zinc-950/40 ring-1 ring-white/5">
                                    <DashboardPreview />
                                </div>
                            </div>
                        </AnimatedGroup>
                    </div>
                </section>
            </main>
        </>
    )
}

// ─── Dashboard Preview ─────────────────────────────────────────────────────

const PREVIEW_LEADS = [
    { initials: 'SK', name: 'Suraj Kumar', title: 'CTO', company: 'LuxMed Health', score: 91, status: 'Reviewed', sent: true },
    { initials: 'PR', name: 'Priya Reddy', title: 'VP Sales', company: 'Stacklayer.io', score: 83, status: 'Pending', sent: false },
    { initials: 'MW', name: 'Marcus Webb', title: 'CEO', company: 'Fenix Analytics', score: 76, status: 'Sent', sent: true },
    { initials: 'SO', name: 'Sofia Orlov', title: 'Founder', company: 'Orion Cloud', score: 88, status: 'Reviewing', sent: false },
]

const STEPS = [
    { label: 'Email 1', icon: Mail, done: true, active: false },
    { label: 'LinkedIn', icon: MessageSquare, done: true, active: false },
    { label: 'Email 2', icon: Mail, done: false, active: true },
    { label: 'Email 3', icon: Mail, done: false, active: false },
    { label: 'Follow-up', icon: Clock, done: false, active: false },
]

function DashboardPreview() {
    return (
        <div className="select-none overflow-hidden bg-[hsl(216,37%,7%)] font-sans text-sm">
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.03] px-5 py-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
                        <span className="text-xs font-medium text-white/70">Acme Corp Healthcare — running</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[hsl(var(--primary)/0.12)] px-2.5 py-1 text-[10px] font-semibold text-[hsl(var(--primary))]">
                        <Zap size={10} />
                        127 credits
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-[9px] font-bold text-white">
                        H
                    </div>
                </div>
            </div>

            {/* Stat chips */}
            <div className="grid grid-cols-5 gap-px border-b border-white/8 bg-white/8">
                {[
                    { label: 'URLs run', val: '1' },
                    { label: 'Leads found', val: '14' },
                    { label: 'Sequences', val: '10' },
                    { label: 'Reviewed', val: '7' },
                    { label: 'Sent today', val: '3' },
                ].map((s) => (
                    <div key={s.label} className="flex flex-col items-center bg-[hsl(216,37%,7%)] py-3">
                        <span className="text-xl font-bold text-white">{s.val}</span>
                        <span className="mt-0.5 text-[9px] text-white/35">{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Content: left = leads, right = sequence */}
            <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                {/* Leads */}
                <div className="border-r border-white/8 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">Leads · ICP scored</span>
                        <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] text-white/40">
                            <Search size={8} />
                            Filter
                        </div>
                    </div>
                    <div className="space-y-2">
                        {PREVIEW_LEADS.map((lead) => (
                            <div
                                key={lead.name}
                                className="group flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-[hsl(var(--primary)/0.3)] hover:bg-white/[0.06]"
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--primary)/0.25)] to-[hsl(var(--accent)/0.15)] text-[10px] font-bold text-[hsl(var(--primary))]">
                                    {lead.initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-xs font-medium text-white/85">
                                        {lead.name}
                                        <span className="ml-1 text-white/40">· {lead.title}</span>
                                    </div>
                                    <div className="text-[10px] text-white/35">{lead.company}</div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <span className={cn(
                                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                        lead.score >= 85
                                            ? 'bg-[hsl(var(--primary)/0.18)] text-[hsl(var(--primary))]'
                                            : 'bg-white/8 text-white/45'
                                    )}>
                                        {lead.score}
                                    </span>
                                    <span className={cn(
                                        'text-[9px] px-1.5 py-0.5 rounded font-medium',
                                        lead.status === 'Sent' ? 'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]' :
                                        lead.status === 'Reviewed' ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]' :
                                        lead.status === 'Reviewing' ? 'bg-yellow-500/15 text-yellow-400' :
                                        'bg-white/8 text-white/35'
                                    )}>
                                        {lead.status}
                                    </span>
                                    <MoreHorizontal size={12} className="text-white/20" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: sequence timeline + approval */}
                <div className="flex flex-col gap-3 p-4">
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
                            Sequence · Suraj Kumar
                        </div>
                        <div className="space-y-2">
                            {STEPS.map((step) => (
                                <div key={step.label} className="flex items-center gap-2.5">
                                    <div className={cn(
                                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[8px]',
                                        step.done
                                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]'
                                            : step.active
                                            ? 'border-[hsl(var(--accent))] text-[hsl(var(--accent))]'
                                            : 'border-white/15 text-white/25'
                                    )}>
                                        {step.done ? <CheckCircle2 size={10} /> : <step.icon size={8} />}
                                    </div>
                                    <span className={cn(
                                        'text-[10px] flex-1',
                                        step.done ? 'text-[hsl(var(--primary))]' :
                                        step.active ? 'font-semibold text-white/90' : 'text-white/30'
                                    )}>
                                        {step.label}
                                    </span>
                                    {step.done && (
                                        <span className="text-[9px] text-white/25">Sent</span>
                                    )}
                                    {step.active && (
                                        <span className="text-[9px] font-medium text-[hsl(var(--accent))]">Queued</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Approval card */}
                    <div className="rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.06)] p-4">
                        <div className="mb-1 text-[10px] font-semibold text-[hsl(var(--primary))]">Awaiting your review</div>
                        <div className="text-[10px] text-white/45 leading-4">
                            7 emails ready to send. Review and approve to launch Day 1 outreach.
                        </div>
                        <div className="mt-3 flex gap-2">
                            <div className="flex-1 rounded-lg bg-[hsl(var(--primary))] py-1.5 text-center text-[10px] font-bold text-white">
                                Approve all
                            </div>
                            <div className="flex-1 rounded-lg border border-white/10 py-1.5 text-center text-[10px] text-white/40">
                                Review one by one
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Nav ───────────────────────────────────────────────────────────────────

const menuItems = [
    { name: 'Features', href: '/features/lead-generation' },
    { name: 'Research hub', href: '/ai-sdr-tools' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'About', href: '/about' },
]

const HeroHeader = () => {
    const [menuState, setMenuState] = React.useState(false)
    const [isScrolled, setIsScrolled] = React.useState(false)

    React.useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <header>
            <nav
                data-state={menuState && 'active'}
                className="fixed z-20 w-full px-2 group">
                <div className={cn(
                    'mx-auto mt-2 max-w-6xl px-6 transition-all duration-300 lg:px-12',
                    isScrolled && 'bg-background/50 max-w-4xl rounded-2xl border backdrop-blur-lg lg:px-5'
                )}>
                    <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
                        <div className="flex w-full justify-between lg:w-auto">
                            <Link href="/" aria-label="AmroGen home" className="flex items-center">
                                <Logo size="sm" />
                            </Link>

                            <button
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden">
                                <Menu className="in-data-[state=active]:rotate-180 group-data-[state=active]:scale-0 group-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                                <X className="group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
                            </button>
                        </div>

                        {/* Desktop centre nav */}
                        <div className="absolute inset-0 m-auto hidden size-fit lg:block">
                            <ul className="flex gap-8 text-sm">
                                {menuItems.map((item) => (
                                    <li key={item.name}>
                                        <Link href={item.href} className="text-muted-foreground hover:text-foreground block duration-150">
                                            {item.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* CTA buttons */}
                        <div className={cn(
                            'bg-background group-data-[state=active]:block lg:group-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent'
                        )}>
                            <div className="lg:hidden">
                                <ul className="space-y-6 text-base">
                                    {menuItems.map((item) => (
                                        <li key={item.name}>
                                            <Link href={item.href} className="text-muted-foreground hover:text-foreground block duration-150">
                                                {item.name}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex w-full flex-col space-y-3 sm:flex-row sm:items-center sm:gap-3 sm:space-y-0 md:w-fit">
                                <ThemeToggle />
                                <Button asChild variant="outline" size="sm" className={cn(isScrolled && 'lg:hidden')}>
                                    <Link href="/sign-in">Sign in</Link>
                                </Button>
                                <Button asChild size="sm" className={cn(isScrolled && 'lg:hidden')}>
                                    <Link href="/sign-up">
                                        <Zap size={14} />
                                        Get started
                                    </Link>
                                </Button>
                                <Button asChild size="sm" className={cn('hidden', isScrolled && 'lg:inline-flex')}>
                                    <Link href="/sign-up">Get started</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}
