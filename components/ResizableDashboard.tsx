import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import MainComponent from "./AddressQueryTool/MainQueryComponent";
import TransactionFlow from "./ReactFlow/TransactionFlow";
import React, { useState } from "react";

export function ResizableDashboard() {
  const [data, setData] = useState<any[]>([]);

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-screen w-full">
      <ResizablePanel defaultSize={30}>
        <div className="flex h-full items-center justify-center">
          <span className="font-semibold">One</span>
          <MainComponent setData={setData} />
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={55}>
            <div className="flex h-full items-center justify-center">
              <TransactionFlow transactions={data} />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={45}>
            <div className="flex h-full items-center justify-center">
              <span className="font-semibold">Three</span>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
