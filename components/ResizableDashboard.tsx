import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable'

export function ResizableDashboard() {
	return (
		<ResizablePanelGroup direction="horizontal" className="min-h-screen w-full">
			<ResizablePanel defaultSize={30}>
				<div className="flex h-full items-center justify-center">
					<span className="font-semibold">One</span>
				</div>
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel>
				<ResizablePanelGroup direction="vertical">
					<ResizablePanel defaultSize={25}>
						<div className="flex h-full items-center justify-center">
							<span className="font-semibold">Two</span>
						</div>
					</ResizablePanel>
					<ResizableHandle />
					<ResizablePanel defaultSize={75}>
						<div className="flex h-full items-center justify-center">
							<span className="font-semibold">Three</span>
						</div>
					</ResizablePanel>
				</ResizablePanelGroup>
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}
