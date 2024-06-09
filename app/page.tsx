import { GlobeComponent } from '@/components/GlobeComponent'
import Link from 'next/link'

export default function Home() {
	return (
		<main className="relative h-screen">
			<div className="h-full overflow-hidden">
				<GlobeComponent />
			</div>
			<div className="absolute bottom-4 left-0 right-0 flex justify-center z-50 text-xs">
				Powered by{' '}
				<Link
					href="https://communeai.org"
					target='_blank'
					className="hover:text-green-500 transition-colors ease-in-out duration-300 ml-1"
				>
					Commune AI
				</Link>
			</div>
		</main>
	)
}
