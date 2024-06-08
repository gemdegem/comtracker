import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import ButtonFetch from "./ButtonFetch";
import MainComponent from "./AddressQueryTool/MainQueryComponent";
import TransactionFlow from "./ReactFlow/TransactionFlow";

export function ResizableDashboard() {
  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-screen w-full">
      <ResizablePanel defaultSize={30}>
        <div className="flex h-full items-center justify-center">
          <span className="font-semibold">One</span>
          <MainComponent />
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={35}>
            <div className="flex h-full items-center justify-center">
              <span className="font-semibold">Two</span>
              <TransactionFlow  />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={65}>
            <div className="flex h-full items-center justify-center">
              <span className="font-semibold">Three</span>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
