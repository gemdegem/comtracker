import '../styles/globals.css'
import type { Metadata } from 'next'
import { Inter as FontSans } from 'next/font/google'

import { cn } from '@/lib/utils'
import Providers from '@/components/Providers'

const fontSans = FontSans({
	subsets: ['latin'],
	variable: '--font-sans',
})

export const metadata: Metadata = {
	title: 'Comtracker — Blockchain Forensics Tool',
	description: 'Trace fund flows between crypto wallets across Ethereum and Solana. Interactive graph visualization, address labels, and token overlap analysis.',
	icons: {
		icon: '/favicon.ico',
		shortcut: '/favicon-16x16.png',
		apple: '/apple-touch-icon.png',
	},
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={cn(
					'dark min-h-screen bg-background font-sans antialiased',
					fontSans.variable
				)}
			>
				<Providers> {children}</Providers>
			</body>
		</html>
	)
}
