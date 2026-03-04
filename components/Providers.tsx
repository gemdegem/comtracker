import { Toaster } from './ui/sonner'
import SuppressWarnings from './SuppressWarnings'

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<>
			<SuppressWarnings />
			{children}
			<Toaster position="bottom-right" />
		</>
	)
}
