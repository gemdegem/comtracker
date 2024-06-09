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
	title: 'COMTRACKER',
	description: 'TOOLS FOR IDENTIFYING INTERWALLET CONNECTIONS.',
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
